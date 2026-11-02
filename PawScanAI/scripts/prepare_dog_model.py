"""Download real pretrained weights and export a self-contained dog model bundle.

Run from the project folder: api/venv/bin/python scripts/prepare_dog_model.py
The server never downloads files. An existing bundle is replaced only with --force.
"""

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
# Keep all caches inside the workspace, including on a fresh installation.
os.environ.setdefault("KERAS_HOME", str(ROOT / "saved_models" / ".cache"))
os.environ.setdefault("MPLCONFIGDIR", "/tmp/matplotlib")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
sys.path.insert(0, str(ROOT))

import tensorflow as tf  # noqa: E402
from api.dog_model import (  # noqa: E402
    DOG_START, DOG_STOP, IMAGE_SIZE, MODEL_NAME, labels_path, load_bundle,
)

CLASS_INDEX_URL = "https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json"


def build_model(weights):
    """The exported model accepts RGB pixels in [0, 255]."""
    base = tf.keras.applications.MobileNetV2(
        input_shape=(*IMAGE_SIZE, 3), weights=weights, include_top=True,
    )
    base.trainable = False
    inputs = tf.keras.Input(shape=(*IMAGE_SIZE, 3), name="rgb_image")
    scaled = tf.keras.layers.Rescaling(1 / 127.5, offset=-1, name="pixel_scaling")(inputs)
    return tf.keras.Model(inputs, base(scaled, training=False), name=MODEL_NAME)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "saved_models/dog_breed.keras")
    parser.add_argument("--weights", type=Path, help="Optional local official MobileNetV2 1.0/224 ImageNet .h5 weights")
    parser.add_argument("--class-index", type=Path, help="Optional local official imagenet_class_index.json")
    parser.add_argument("--force", action="store_true", help="Replace an existing bundle")
    args = parser.parse_args()
    output = args.output.resolve()
    if output.exists() and not args.force:
        load_bundle(output)
        print(f"Verified existing dog breed model: {output}")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        index_path = args.class_index or tf.keras.utils.get_file(
            "imagenet_class_index.json", CLASS_INDEX_URL,
            cache_dir=os.environ["KERAS_HOME"], cache_subdir="models",
            file_hash="c2c37ea517e94d9795004a39431a14cb", hash_algorithm="md5",
        )
        with Path(index_path).open() as source:
            index = json.load(source)
        if (len(index) != 1000 or index["151"] != ["n02085620", "Chihuahua"]
                or index["268"] != ["n02113978", "Mexican_hairless"]):
            raise ValueError("Expected the official 1,000-class ImageNet label index.")
        metadata = {
            "source": CLASS_INDEX_URL, "model": "MobileNetV2 ImageNet 1.0 224",
            "class_indices": list(range(DOG_START, DOG_STOP)),
            "class_names": [index[str(i)][1].replace("_", " ").capitalize()
                            for i in range(DOG_START, DOG_STOP)],
        }
        # Never export random weights: the command always uses pretrained weights.
        model = build_model(str(args.weights.resolve()) if args.weights else "imagenet")
        with tempfile.TemporaryDirectory(dir=output.parent) as directory:
            temporary_model = Path(directory) / output.name
            model.save(temporary_model)
            temporary_labels = labels_path(temporary_model)
            temporary_labels.write_text(json.dumps(metadata, indent=2) + "\n")
            load_bundle(temporary_model)
            temporary_labels.replace(labels_path(output))
            temporary_model.replace(output)
        print(f"Ready: {len(metadata['class_names'])} dog breed categories. Saved {output}")
    except Exception as exc:
        parser.exit(1, f"Model setup failed: {exc}\nRun this command with internet access, or supply --weights and --class-index local files.\n")


if __name__ == "__main__":
    main()
