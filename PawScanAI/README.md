# PawScan AI — Dog Breed Recognition

Upload a dog photo in the React web app or Expo mobile app to see the three most
likely breed matches. FastAPI runs MobileNetV2 with genuine pretrained ImageNet
weights, covering **118 dog breed categories**. The project folder retains its
original `potatoDisease` name so existing local paths keep working.

This version uses an existing pretrained model; it has **not** been fine-tuned on
Stanford Dogs. The original potato models and training notebooks are retained for
reference and are not used by the current API.

## Run locally

Use Python 3.12 and Node.js 22. From this project folder:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r api/requirements.txt
.venv/bin/python scripts/prepare_dog_model.py
.venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

On this computer, you can use the existing `api/venv/bin/python` in place of
`.venv/bin/python` in all commands. In particular, the one-time model setup is:

```bash
api/venv/bin/python scripts/prepare_dog_model.py
```

Setup requires internet access once. It downloads the official ImageNet class
index and MobileNetV2 1.0/224 weights, then saves:

- `saved_models/dog_breed.keras`: model with RGB pixel scaling included.
- `saved_models/dog_breed.labels.json`: 118 names in the original ImageNet order.

The script verifies and reuses an existing bundle; use `--force` to replace it.
The API does not download files. If setup has not completed, `/ping` reports
`model_ready: false` and prediction requests return HTTP 503 with setup instructions.
Restart the API after preparing the model.

Start the web client in another terminal:

```bash
cd frontend
npm ci --legacy-peer-deps
npm start
```

Open http://localhost:3000, choose a dog photo, and view its top three matches.
`frontend/.env` uses `http://localhost:8000/predict`; see `.env.example`.
For the Android app, follow [Android setup](docs/ANDROID_SETUP.md).
The [PawScan design notes](docs/PAWSCAN_DESIGN.md) describe the icon, theme,
and how to rebuild the launcher icon.

## How predictions work

Photos are oriented using EXIF, converted to RGB, and resized to 224×224 using
bilinear interpolation. The exported model scales raw pixels from [0, 255] to
[-1, 1] exactly once and predicts all 1,000 ImageNet categories. The API ranks the
118 dog categories at ImageNet indices 151–268 inclusive. Wild canids, including
wolves, are excluded.

To avoid forcing a breed result on every upload, a photo is accepted only when
the highest-scoring ImageNet category is a dog breed and the combined dog score
is at least 0.5. Otherwise the app displays “No dog recognized.” This rule is a
heuristic, not a separately trained dog detector, and can make mistakes.

Breed scores remain the original model probabilities across 1,000 categories;
they are **not** renormalized among dogs or among the top three. The displayed
scores may sum to less than 100%. These are uncalibrated visual estimates, not
ancestry measurements. Mixed breeds, unsupported breeds, multiple dogs, poor
lighting, and unfamiliar backgrounds can produce uncertain or incorrect matches.
A low top score is still displayed so uncertainty remains visible.

## API

- `GET /ping`: process health and `model_ready`.
- `GET /breeds`: supported names and count (requires model setup).
- `POST /predict`: multipart upload with a `file` field, maximum 10 MiB.
- `GET /docs`: interactive API documentation.

A recognized dog returns this response shape (illustrative scores):

```json
{
  "status": "ok",
  "class": "Golden retriever",
  "confidence": 0.65,
  "dog_score": 0.95,
  "predictions": [
    {"class": "Golden retriever", "confidence": 0.65},
    {"class": "Labrador retriever", "confidence": 0.20},
    {"class": "Beagle", "confidence": 0.10}
  ],
  "message": "Visual breed estimates can be uncertain, especially for mixed-breed dogs."
}
```

Unrecognized images return HTTP 200 with `status: "no_dog_detected"`, null
`class` and `confidence`, an empty `predictions` array, and a helpful message.
Invalid images return 400, oversized files 413, missing file fields 422, and an
unavailable model 503. `class` and `confidence` remain available on successful
dog predictions for clients that used the original API.

`MODEL_PATH` overrides the bundle path; a matching `.labels.json` file must sit
alongside it. Only bundles produced by `scripts/prepare_dog_model.py` are
supported. `CORS_ORIGINS` accepts comma-separated origins for separate clients.

## Model setup without automatic downloads

If downloading with Python is unavailable, obtain these two official files on a
computer with internet access and copy them locally:

- [MobileNetV2 ImageNet 1.0/224 weights](https://storage.googleapis.com/tensorflow/keras-applications/mobilenet_v2/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5)
- [ImageNet class index](https://storage.googleapis.com/download.tensorflow.org/data/imagenet_class_index.json)

Then run:

```bash
api/venv/bin/python scripts/prepare_dog_model.py \
  --weights /path/to/mobilenet_v2_weights_tf_dim_ordering_tf_kernels_1.0_224.h5 \
  --class-index /path/to/imagenet_class_index.json
```

Caches stay under `saved_models/.cache/` by default. `KERAS_HOME` can override
that location. The dog bundle and caches are excluded from Git.

## Run checks

```bash
cd frontend
CI=true npm test -- --watchAll=false --runInBand
CI=true npm run build
cd ..
MPLCONFIGDIR=/tmp/matplotlib TF_CPP_MIN_LOG_LEVEL=2 \
  api/venv/bin/python -m unittest discover -s tests -v
cd mobile-app-new
npx tsc --noEmit
npx eslint app/index.tsx app/_layout.tsx
```

API tests substitute deterministic model scores while exercising real multipart
uploads, preprocessing, top-three ranking, non-dog rejection, unavailable-model
errors, CORS, and the built homepage. A separate structural test exports and
reloads MobileNetV2 with random weights in a temporary directory only; no random
weights are saved to the app's model path. An integration smoke test loads the
real pretrained bundle if installed, otherwise explicitly skips. These checks
are not a measurement of breed recognition accuracy on a labeled holdout set.

## Build and deploy

The Dockerfile builds React, downloads the pretrained dog model during the image
build, and serves the frontend and API on the same origin. Runtime requests need
no external model service. Building requires network access and a Docker daemon:

```bash
docker build -t dog-breed .
docker run --rm -p 8080:8080 dog-breed
```

Open http://localhost:8080. For a local production preview without Docker:

```bash
cd frontend
npm run build
cd ..
api/venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Open http://localhost:8000. Prepare the model before starting the API.

For Google Cloud Run, configure billing and authenticate from a terminal with
Google Cloud access:

```bash
gcloud auth login
export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project "$GOOGLE_CLOUD_PROJECT"
PUBLIC=true ./scripts/deploy-cloud-run.sh
```

The service defaults to `dog-breed` in Seoul (`asia-northeast3`), 2 GiB RAM,
1 CPU, concurrency 1, and 0–1 instances. Override `SERVICE_NAME` or `REGION` as
needed. Builds, storage, and requests can incur charges. Omit `PUBLIC=true` to
require authentication. No cloud deployment is performed by local setup.

## Reference folders

- `mobile-app-new/`: current Expo SDK 54 client for the dog API.
- `mobile-app/`, `gcp/`, `api/main-tf-serving.py`, `training/`: original potato
  tutorial code, not converted or used by the current app.
- `saved_models/model*.keras`, `saved_models/potato/`: original potato models,
  retained separately.

References: [Keras MobileNetV2](https://keras.io/api/applications/mobilenet/),
[TensorFlow transfer learning](https://www.tensorflow.org/tutorials/images/transfer_learning),
[Cloud Run deployment](https://docs.cloud.google.com/run/docs/deploying-source-code).
