from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from io import BytesIO
from PIL import Image
import requests

# -----------------------------
# App setup
# -----------------------------
app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Config
# -----------------------------
TF_SERVING_URL = "http://localhost:8501/v1/models/potato:predict"

CLASS_NAMES = [
    "Early Blight",
    "Late Blight",
    "Healthy"
]

IMAGE_SIZE = (224, 224)

# -----------------------------
# Utils
# -----------------------------
def read_file_as_image(data: bytes) -> np.ndarray:
    image = Image.open(BytesIO(data)).convert("RGB")
    image = image.resize(IMAGE_SIZE)
    image = np.array(image) / 255.0
    return image.astype("float32")

# -----------------------------
# Routes
# -----------------------------
@app.get("/ping")
async def ping():
    return {"message": "API is alive"}

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Read & preprocess image
    image = read_file_as_image(await file.read())

    # TF Serving expects a batch
    payload = {
        "instances": [image.tolist()]
    }

    # Send request to TensorFlow Serving
    response = requests.post(TF_SERVING_URL, json=payload)

    if response.status_code != 200:
        return {
            "error": "Model server error",
            "details": response.text
        }

    predictions = response.json()["predictions"][0]

    predicted_class = CLASS_NAMES[np.argmax(predictions)]
    confidence = float(np.max(predictions))

    return {
        "class": predicted_class,
        "confidence": confidence
    }
