"""Test upload handling and breed interpretation without downloading weights.

Only the model call is substituted for API tests; multipart requests, image
preprocessing, routing, and breed score interpretation all run normally.
"""
import asyncio
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
from api.main import app, MAX_UPLOAD_BYTES, MODEL_PATH, read_file_as_image
from api.dog_model import DOG_START, DOG_STOP, interpret_predictions, labels_path, load_bundle

ROOT = Path(__file__).resolve().parents[1]
CLASS_NAMES = [f'Breed {i}' for i in range(DOG_STOP - DOG_START)]
CLASS_NAMES[162 - DOG_START] = 'Beagle'
CLASS_NAMES[207 - DOG_START] = 'Golden retriever'
CLASS_NAMES[208 - DOG_START] = 'Labrador retriever'


def dog_scores():
    scores = np.zeros(1000, dtype=np.float32)
    scores[207], scores[208], scores[162], scores[281] = 0.65, 0.20, 0.10, 0.05
    return scores


class StubModel:
    def __init__(self):
        self.scores = dog_scores()
        self.inputs = None

    def __call__(self, inputs, training=False):
        self.inputs = inputs
        return np.expand_dims(self.scores, 0)


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.loop = asyncio.new_event_loop()
        # Wake the loop when sandbox restrictions prevent thread socket wakeups.
        def tick():
            cls.heartbeat = cls.loop.call_later(0.01, tick)
        cls.heartbeat = cls.loop.call_later(0.01, tick)
        cls.loader = patch('api.main.load_bundle', return_value=(StubModel(), CLASS_NAMES))
        cls.loader.start()
        cls.lifespan = app.router.lifespan_context(app)
        cls.loop.run_until_complete(cls.lifespan.__aenter__())

    @classmethod
    def tearDownClass(cls):
        cls.loop.run_until_complete(cls.lifespan.__aexit__(None, None, None))
        cls.loader.stop()
        cls.heartbeat.cancel()
        cls.loop.close()

    def setUp(self):
        app.state.model = StubModel()
        app.state.class_names = CLASS_NAMES

    def request(self, method, path, body=b'', headers=None):
        async def run():
            messages = []
            received = False
            async def receive():
                nonlocal received
                if received:
                    await asyncio.Event().wait()
                received = True
                return {'type': 'http.request', 'body': body, 'more_body': False}
            async def send(message):
                messages.append(message)
            await app({
                'type': 'http', 'asgi': {'version': '3.0'}, 'http_version': '1.1',
                'method': method, 'scheme': 'http', 'path': path, 'raw_path': path.encode(),
                'query_string': b'', 'root_path': '', 'headers': headers or [],
                'server': ('testserver', 80), 'client': ('127.0.0.1', 1234),
            }, receive, send)
            start = next(m for m in messages if m['type'] == 'http.response.start')
            content = b''.join(m.get('body', b'') for m in messages if m['type'] == 'http.response.body')
            return start['status'], content, dict(start['headers'])
        return self.loop.run_until_complete(asyncio.wait_for(run(), timeout=30))

    def upload(self, data, filename='dog.jpg'):
        boundary = 'dog-test-boundary'
        body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                'Content-Type: application/octet-stream\r\n\r\n').encode() + data + f'\r\n--{boundary}--\r\n'.encode()
        return self.request('POST', '/predict', body, [
            (b'content-type', f'multipart/form-data; boundary={boundary}'.encode()),
            (b'content-length', str(len(body)).encode()),
        ])

    def image_bytes(self, mode='RGB'):
        buffer = BytesIO()
        Image.new(mode, (67, 95)).save(buffer, format='PNG')
        return buffer.getvalue()

    def test_health(self):
        status, body, _ = self.request('GET', '/ping')
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)['model_ready'])

    def test_supported_breeds(self):
        status, body, _ = self.request('GET', '/breeds')
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {'count': 118, 'breeds': CLASS_NAMES})

    def test_top_three_predictions_and_original_scores(self):
        status, body, _ = self.upload(self.image_bytes())
        self.assertEqual(status, 200, body)
        result = json.loads(body)
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['class'], 'Golden retriever')
        self.assertEqual([p['class'] for p in result['predictions']],
                         ['Golden retriever', 'Labrador retriever', 'Beagle'])
        self.assertAlmostEqual(result['confidence'], 0.65)
        self.assertAlmostEqual(result['dog_score'], 0.95)
        self.assertEqual(app.state.model.inputs.shape, (1, 224, 224, 3))

    def test_non_dog_does_not_return_a_breed(self):
        scores = np.zeros(1000, dtype=np.float32)
        scores[281], scores[207] = 0.9, 0.1  # Tabby cat, golden retriever.
        app.state.model.scores = scores
        status, body, _ = self.upload(self.image_bytes())
        self.assertEqual(status, 200)
        result = json.loads(body)
        self.assertEqual(result['status'], 'no_dog_detected')
        self.assertIsNone(result['class'])
        self.assertIsNone(result['confidence'])
        self.assertEqual(result['predictions'], [])

    def test_missing_model_has_actionable_setup_error(self):
        app.state.model = None
        status, body, _ = self.upload(self.image_bytes())
        self.assertEqual(status, 503)
        self.assertIn('prepare_dog_model.py', json.loads(body)['detail'])
        self.assertFalse(json.loads(self.request('GET', '/ping')[1])['model_ready'])
        self.assertEqual(self.request('GET', '/breeds')[0], 503)

    def test_missing_model_startup_keeps_health_available(self):
        async def startup():
            with patch('api.main.load_bundle', side_effect=FileNotFoundError('missing')):
                async with app.router.lifespan_context(app):
                    self.assertIsNone(app.state.model)
        self.loop.run_until_complete(startup())

    def test_invalid_model_output_returns_500(self):
        for scores in (np.zeros(3), np.full(1000, np.nan), np.zeros(1000)):
            with self.subTest(shape=scores.shape):
                app.state.model.scores = scores
                self.assertEqual(self.upload(self.image_bytes())[0], 500)

    def test_grayscale_and_rgba_images(self):
        for mode in ('L', 'RGBA'):
            with self.subTest(mode=mode):
                self.assertEqual(self.upload(self.image_bytes(mode), 'dog.png')[0], 200)

    def test_preprocessing_preserves_raw_rgb(self):
        buffer = BytesIO()
        Image.new('RGB', (10, 20), (255, 128, 0)).save(buffer, format='PNG')
        image = read_file_as_image(buffer.getvalue())
        self.assertEqual(image.shape, (224, 224, 3))
        self.assertEqual(image.dtype, np.float32)
        np.testing.assert_array_equal(image[0, 0], [255, 128, 0])

    def test_exif_orientation_is_applied(self):
        source = Image.new('RGB', (40, 20), (0, 0, 0))
        source.paste((255, 0, 0), (0, 0, 20, 20))
        exif = source.getexif()
        exif[274] = 6  # Rotate 90 degrees clockwise: left red becomes top red.
        buffer = BytesIO()
        source.save(buffer, format='JPEG', exif=exif)
        image = read_file_as_image(buffer.getvalue())
        self.assertGreater(image[10, 112, 0], 240)
        self.assertLess(image[210, 112, 0], 10)

    def test_empty_and_invalid_uploads(self):
        for data in (b'', b'this is not an image'):
            with self.subTest(data=data):
                self.assertEqual(self.upload(data)[0], 400)

    def test_oversized_upload(self):
        self.assertEqual(self.upload(b'x' * (MAX_UPLOAD_BYTES + 1))[0], 413)

    def test_missing_file(self):
        self.assertEqual(self.request('POST', '/predict')[0], 422)

    def test_cors_preflight(self):
        status, _, headers = self.request('OPTIONS', '/predict', headers=[
            (b'origin', b'http://localhost:3000'),
            (b'access-control-request-method', b'POST'),
        ])
        self.assertEqual(status, 200)
        self.assertEqual(headers[b'access-control-allow-origin'], b'http://localhost:3000')

    def test_production_homepage_when_built(self):
        if not (ROOT / 'frontend/build/index.html').is_file():
            self.skipTest('Run npm run build in frontend first.')
        status, body, headers = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertIn(b'text/html', headers[b'content-type'])
        self.assertIn(b'Dog Breed Recognition', body)


class ScoreTests(unittest.TestCase):
    def test_dog_class_boundaries_exclude_wolves(self):
        for index, accepted in ((150, False), (151, True), (268, True), (269, False)):
            with self.subTest(index=index):
                scores = np.zeros(1000)
                scores[index] = 1
                result = interpret_predictions(scores, CLASS_NAMES)
                self.assertEqual(result['status'] == 'ok', accepted)

    def test_low_total_dog_score_is_rejected(self):
        scores = np.full(1000, 0.6 / 999)
        scores[207] = 0.4  # Dog wins argmax, but most probability is elsewhere.
        self.assertEqual(interpret_predictions(scores, CLASS_NAMES)['status'], 'no_dog_detected')

    def test_invalid_probability_vectors_are_rejected(self):
        for change in ('negative', 'above_one', 'infinite', 'sum'):
            scores = dog_scores()
            if change == 'negative': scores[0] = -0.1
            if change == 'above_one': scores[207] = 1.1
            if change == 'infinite': scores[0] = np.inf
            if change == 'sum': scores *= 0.5
            with self.subTest(change=change), self.assertRaises(ValueError):
                interpret_predictions(scores, CLASS_NAMES)


class BundleTests(unittest.TestCase):
    def test_export_roundtrip_and_embedded_preprocessing(self):
        from scripts.prepare_dog_model import build_model
        # Random weights are confined to this structural test, never app artifacts.
        model = build_model(weights=None)
        scaled = model.get_layer('pixel_scaling')(np.array([0, 127.5, 255]))
        np.testing.assert_allclose(scaled, [-1, 0, 1], atol=1e-6)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.keras'
            model.save(path)
            labels_path(path).write_text(json.dumps({
                'class_indices': list(range(DOG_START, DOG_STOP)), 'class_names': CLASS_NAMES,
            }))
            loaded, names = load_bundle(path)
            self.assertEqual(names, CLASS_NAMES)
            scores = loaded(np.zeros((1, 224, 224, 3), dtype=np.float32), training=False)
            self.assertEqual(scores.shape, (1, 1000))
            self.assertAlmostEqual(float(np.asarray(scores).sum()), 1, places=5)

    def test_invalid_labels_rejected_before_model_load(self):
        for metadata in (
            {'class_indices': [0, 1], 'class_names': ['Cat', 'Dog']},
            {'class_indices': list(range(DOG_START, DOG_STOP)), 'class_names': ['Dog'] * 118},
        ):
            with self.subTest(metadata=metadata), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'bad.keras'
                labels_path(path).write_text(json.dumps(metadata))
                with self.assertRaises(ValueError):
                    load_bundle(path)

    def test_potato_model_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'potato.keras'
            path.symlink_to(ROOT / 'saved_models/model1.keras')
            labels_path(path).write_text(json.dumps({
                'class_indices': list(range(DOG_START, DOG_STOP)), 'class_names': CLASS_NAMES,
            }))
            with self.assertRaisesRegex(ValueError, 'setup command'):
                load_bundle(path)

    @unittest.skipUnless(MODEL_PATH.is_file() and labels_path(MODEL_PATH).is_file(),
                         'Pretrained weights unavailable; run scripts/prepare_dog_model.py first.')
    def test_installed_pretrained_bundle(self):
        model, names = load_bundle(MODEL_PATH)
        scores = np.asarray(model(np.zeros((1, 224, 224, 3), dtype=np.float32), training=False))[0]
        self.assertEqual(len(names), 118)
        self.assertIn(interpret_predictions(scores, names)['status'], ('ok', 'no_dog_detected'))


if __name__ == '__main__':
    unittest.main()
