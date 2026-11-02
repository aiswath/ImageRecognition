# PawScanAI workspace

The application is in [`PawScanAI/`](PawScanAI/README.md). Run these commands
in separate terminals from this workspace directory.

## Prediction API

```bash
cd PawScanAI
MPLCONFIGDIR=/tmp/pawscan-matplotlib TF_CPP_MIN_LOG_LEVEL=2 \
  .venv/bin/python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```

Check http://localhost:8000/ping. If it already reports `model_ready: true`,
reuse that API instead of starting a second instance.

## Web app

```bash
cd PawScanAI/frontend
BROWSER=none CHOKIDAR_USEPOLLING=true WATCHPACK_POLLING=true npm start
```

Open http://localhost:3000. Polling avoids the machine's file-watcher limit.

## Android app

```bash
~/Android/Sdk/emulator/emulator -avd Pixel_6 -memory 2048 -cores 2 -no-snapshot-load
```

In another terminal:

```bash
cd PawScanAI/mobile-app-new
CI=1 EXPO_OFFLINE=1 npx expo start --go --port 8081
```

Once the emulator has booted, open the app:

```bash
~/Android/Sdk/platform-tools/adb -e shell am start \
  -a android.intent.action.VIEW -d exp://10.0.2.2:8081 host.exp.exponent
```

`CI=1` avoids the file-watcher limit by disabling automatic reload. Restart Expo
after code changes. `EXPO_OFFLINE=1` skips online checks using the installed
dependencies. See [Android setup](PawScanAI/docs/ANDROID_SETUP.md) for details.

## Git

This workspace uses a single repository rooted here. The previous independent
web and mobile Git metadata is preserved under
`.git/preserved-repositories/frontend` and
`.git/preserved-repositories/mobile-app-new`. For example, inspect web history:

```bash
git --git-dir=.git/preserved-repositories/frontend \
  --work-tree=PawScanAI/frontend log --oneline
```

These archived Git directories are local backups and are not included in a
clone. The GitHub repository contains the project source; dependencies, local
environment files, and downloaded dog-model files are excluded. Follow the
[application setup](PawScanAI/README.md#run-locally) after cloning to install
dependencies and prepare the model. Use `git status` here to review changes.
