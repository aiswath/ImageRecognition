"""Load the prepared ImageNet model and interpret its dog breed scores."""

import json
from pathlib import Path

import numpy as np
import tensorflow as tf

IMAGE_SIZE = (224, 224)
DOG_START = 151
DOG_STOP = 269  # Exclusive: wolves and other wild canids are not dog breeds.
MODEL_NAME = "dog_breed_mobilenet_v2"
SETUP_COMMAND = "api/venv/bin/python scripts/prepare_dog_model.py"


def labels_path(model_path: Path) -> Path:
    return model_path.with_suffix(".labels.json")


def load_bundle(model_path: Path):
    """No network access or automatic downloads in the prediction server."""
    with labels_path(model_path).open() as source:
        metadata = json.load(source)
    if metadata.get("class_indices") != list(range(DOG_START, DOG_STOP)):
        raise ValueError("The dog breed class indices do not match ImageNet.")
    names = metadata.get("class_names")
    if (not isinstance(names, list) or len(names) != DOG_STOP - DOG_START
            or not all(isinstance(name, str) and name.strip() for name in names)
            or len(set(names)) != len(names)):
        raise ValueError("The dog breed labels are invalid.")
    model = tf.keras.models.load_model(model_path, compile=False)
    if (model.name != MODEL_NAME or model.input_shape != (None, *IMAGE_SIZE, 3)
            or model.output_shape != (None, 1000)):
        raise ValueError("Use the MobileNetV2 bundle produced by the setup command.")
    return model, names


def interpret_predictions(predictions, class_names):
    """Keep original 1,000-class probabilities; do not inflate breed confidence."""
    scores = np.asarray(predictions)
    if (scores.shape != (1000,) or not np.all(np.isfinite(scores))
            or np.any(scores < 0) or np.any(scores > 1)
            or not np.isclose(scores.sum(), 1, atol=0.001)):
        raise ValueError("The model returned an invalid prediction.")
    dog_scores = scores[DOG_START:DOG_STOP]
    dog_score = float(dog_scores.sum())
    # This is a heuristic rejection rule, not a trained dog detector.
    is_dog = DOG_START <= int(np.argmax(scores)) < DOG_STOP and dog_score >= 0.5
    if not is_dog:
        return {
            "status": "no_dog_detected", "class": None, "confidence": None,
            "dog_score": dog_score, "predictions": [],
            "message": "No dog recognized. Try a clear photo of one dog, filling the frame.",
        }
    indices = np.argsort(-dog_scores, kind="stable")[:3]
    top = [{"class": class_names[int(i)], "confidence": float(dog_scores[i])}
           for i in indices]
    return {
        "status": "ok", "class": top[0]["class"],
        "confidence": top[0]["confidence"], "dog_score": dog_score,
        "predictions": top,
        "message": "Visual breed estimates can be uncertain, especially for mixed-breed dogs.",
    }
