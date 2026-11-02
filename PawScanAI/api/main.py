"""Prediction API. Run from the project root with uvicorn api.main:app."""

from contextlib import asynccontextmanager
from io import BytesIO
import os
from pathlib import Path
import warnings
import logging

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from api.dog_model import IMAGE_SIZE, SETUP_COMMAND, interpret_predictions, load_bundle

ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(ROOT / "saved_models/dog_breed.keras")))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.model = None
    app.state.class_names = []
    try:
        app.state.model, app.state.class_names = load_bundle(MODEL_PATH)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        logging.getLogger(__name__).warning(
            "Dog model unavailable: %s. Run: %s", exc, SETUP_COMMAND,
        )
    yield


app = FastAPI(title="Dog Breed Recognition API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/ping")
def ping():
    return {"message": "API is alive", "model_ready": app.state.model is not None}


def require_model():
    if app.state.model is None:
        raise HTTPException(
            status_code=503,
            detail=f"Dog breed model is not installed. Run from the project folder: {SETUP_COMMAND}, then restart the API.",
        )


@app.get("/breeds")
def breeds():
    require_model()
    return {"breeds": app.state.class_names, "count": len(app.state.class_names)}


def read_file_as_image(data: bytes) -> np.ndarray:
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as source:
                image = ImageOps.exif_transpose(source).convert("RGB").resize(
                    IMAGE_SIZE, Image.Resampling.BILINEAR,
                )
                # The exported dog model scales raw RGB pixels to [-1, 1].
                return np.asarray(image, dtype=np.float32)
    except (UnidentifiedImageError, OSError, ValueError,
            Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise HTTPException(status_code=400, detail="Upload a valid image.") from exc


@app.post("/predict")
def predict(file: UploadFile = File(...)):
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 10 MiB or smaller.")
    image = read_file_as_image(data)
    require_model()
    predictions = np.asarray(app.state.model(np.expand_dims(image, 0), training=False))[0]
    try:
        return interpret_predictions(predictions, app.state.class_names)
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# The production container serves the React build and API on the same origin.
FRONTEND_BUILD = Path(os.getenv("FRONTEND_BUILD", str(ROOT / "frontend/build")))
if FRONTEND_BUILD.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_BUILD, html=True), name="frontend")
