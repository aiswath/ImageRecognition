# Run the dog breed Android app

The app needs three processes: an Android emulator, the Python prediction API,
and the Expo development server. Keep each in its own terminal.

## One-time setup

Install Python 3.12, Node.js 22, and Android Studio with Android SDK Platform
Tools and Android Emulator. Create an x86_64 Android virtual device in Android
Studio's Device Manager. The steps below use the existing `Pixel_6` device on
the development laptop; substitute your device name on another computer.

From the `potatoDisease` project folder:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r api/requirements.txt
.venv/bin/python scripts/prepare_dog_model.py
```

In another terminal, from the same project folder:

```bash
cd mobile-app-new
npm ci
```

The project uses Expo SDK 54. Use an Expo Go Android version compatible with
SDK 54, available from https://expo.dev/go.

## 1. Start the emulator

Close heavy applications. On the development laptop, use `Pixel_6` rather than
the Fold device: the Fold was configured for about 11 GB of RAM.

In terminal 1:

```bash
~/Android/Sdk/emulator/emulator -accel-check
```

Confirm that KVM is usable before starting the emulator. Then run:

```bash
~/Android/Sdk/platform-tools/adb start-server
~/Android/Sdk/emulator/emulator -avd Pixel_6 \
  -memory 2048 -cores 2 -no-snapshot-load
```

Wait for the Android home screen. Android Studio can remain closed.

## 2. Start the Python API

In terminal 2, change to the `potatoDisease` project folder and run:

```bash
.venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Wait for `Application startup complete`. The API loads
`saved_models/dog_breed.keras` and its labels. Leave the terminal running.
If the weights are missing, run the setup command above with internet access,
then restart the API. The existing `api/venv/bin/python` can replace
`.venv/bin/python` in these commands.

On the laptop, visit http://localhost:8000/ping. Inside the emulator, open
Chrome and visit http://10.0.2.2:8000/ping. Both should return:

```json
{"message":"API is alive","model_ready":true}
```

`10.0.2.2` is the Android emulator address for reaching the laptop. A physical
phone needs the laptop's LAN IP instead. Copy
`mobile-app-new/.env.example` to `mobile-app-new/.env` and set
`EXPO_PUBLIC_API_URL=http://YOUR_LAPTOP_LAN_IP:8000/predict`. Use the same Wi-Fi
network and restart Expo after changing the environment variable.

To find Chrome, tap the emulator's round Home button, swipe up from the bottom
of the phone screen, and tap Chrome in the app list.

## 3. Start Expo

In terminal 3, change to the `potatoDisease` project folder and run:

```bash
cd mobile-app-new
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
npx expo start --go
```

Press `a` when Expo is ready. Leave this terminal running.

## 4. Add a photo if the gallery is empty

Photos already copied remain available across ordinary emulator restarts. To
copy a real dog photo (replace `/path/to/your/dog.jpg`), open another terminal in the `potatoDisease` project folder:

```bash
~/Android/Sdk/platform-tools/adb push \
  /path/to/your/dog.jpg \
  /sdcard/Download/dog.jpg

~/Android/Sdk/platform-tools/adb shell am broadcast \
  -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
  -d file:///sdcard/Download/dog.jpg
```

Wait a few seconds and reopen the photo picker. Check Photos or
Albums > Downloads.

## 5. Make a prediction

1. Tap **Pick from Gallery**.
2. Select the dog photo.
3. Tap **CROP** at the top-right to confirm it.
4. Wait for the upload and prediction.
5. Scroll down to see the three breed matches and their prediction scores.
   If no dog is recognized, try a closer, well-lit photo of one dog.

To return from Chrome to the app, tap the square Recent Apps button on the
emulator toolbar and select Expo Go. Alternatively, press `a` in the Expo
terminal to reopen the app.

## Troubleshooting

- **Device offline:** wait for Android to finish booting, then check
  `~/Android/Sdk/platform-tools/adb devices`. If it remains offline, run:

  ```bash
  ~/Android/Sdk/platform-tools/adb kill-server
  ~/Android/Sdk/platform-tools/adb start-server
  ~/Android/Sdk/platform-tools/adb reconnect offline
  ~/Android/Sdk/platform-tools/adb devices
  ```

- **Could not connect to API:** check `/ping` in emulator Chrome, verify that
  the Python API terminal is running, and inspect its output after selecting
  an image. The app displays API errors, including the model setup instructions if
  the pretrained bundle is missing. Check that `/ping` reports `model_ready: true`.
- **Address already in use:** another process is using port 8000. Check whether
  the API is already available at `/ping` before starting another instance.

## Stop the app

Press Ctrl+C in the Expo and API terminals, then close the emulator window.

References: [Expo startup](https://docs.expo.dev/get-started/start-developing/),
[Android emulator options](https://developer.android.com/studio/run/emulator-commandline),
and [ADB](https://developer.android.com/tools/adb).
