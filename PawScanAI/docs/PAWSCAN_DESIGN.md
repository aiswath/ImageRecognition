# PawScan AI design

The mobile and web clients now use the user's dog illustration as their brand
reference. The uploaded image is preserved byte for byte in
`mobile-app-new/assets/images/pawscan-original.png` and appears in the mobile
header. The same source is copied to `frontend/src/pawscan.png`.

## Appearance and behavior

The palette follows the artwork: cream `#FFF9EF`, warm brown `#4B2B22`, deep
orange `#BB430D`, peach `#FFF0DF`, and golden yellow `#FFD66B`. Deep orange with
white labels keeps primary actions readable. The app deliberately uses a light
theme, including dark status bar text and safe-area backgrounds.

The welcome screen includes the three dog mascots, a supported-breed badge,
large gallery and camera buttons, and a photo tip. The selected-photo screen
keeps photo replacement and scan cancellation available. Results show three
ranked matches with bars based on the original model scores. Low-confidence
results use less certain wording. Loading, errors, and unrecognized photos each
have their own matching card. The mobile entrance animation respects the
system's reduced-motion setting; buttons expose their disabled state to screen
readers. The web version shares the palette, mascots, branding and result bars.

## Assets

All project-bound generated images are saved in this repository:

- `mobile-app-new/assets/images/pawscan-icon.png`: opaque 1024×1024 full-color
  launcher and splash image, also used as the Expo web favicon.
- `mobile-app-new/assets/images/pawscan-mascots.png`: transparent three-dog
  illustration for the welcome card.
- `mobile-app-new/assets/images/pawscan-adaptive.png`: 1024×1024 transparent
  Android foreground with extra padding to keep dogs within icon masks.
- `frontend/public/pawscan-icon.png`: browser and installable-web-app icon.
- `frontend/src/pawscan-mascots.png`: matching web illustration.

The icon and transparent mascots were prepared with the built-in **imagegen**
tool using the uploaded image as the edit target. Expo's existing image utilities
exported the square platform sizes and padded adaptive foreground. The original
upload was not overwritten. The adaptive background is golden `#FFBE3B`.

## View the changes

From `potatoDisease/mobile-app-new`:

```bash
npx expo start --go --clear
```

Open the project again in Expo Go. A reload may suffice for screen changes.
The launcher icon of Expo Go itself stays the Expo Go icon; installing a native
build gives PawScan its own launcher icon and name. With Android development
tools configured, build and install locally using:

```bash
npx expo run:android
```

Native icon and splash changes require a rebuilt app. The actual splash screen
should be checked in a preview/release build; Expo Go does not faithfully
preview it. No native APK build, device installation, signing, or publishing is
performed by the UI source changes.

The React web client uses its usual `npm start` / `npm run build` commands.
Its browser tab and web manifest now identify it as PawScan AI.

References: [Expo SDK 54 configuration](https://github.com/expo/expo/blob/sdk-54/docs/pages/versions/v54.0.0/config/app.mdx)
and [Expo icons and splash screens](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/).

## Image generation prompts

Both assets used the built-in tool, with the original uploaded image as their
reference. These are the final prompt texts.

### Square icon

> Use case: precise-object-edit. Asset type: production square app icon, PNG, exactly 1024 x 1024 pixels. Edit target: the provided PawScan AI image. Preserve the exact original three adorable dog characters (corgi left, golden retriever middle, husky right), their expressions, poses, outlines, proportions, and warm yellow-to-orange background, and the exact white lettering "PawScan AI" below them. Prepare the existing artwork as a full-bleed square app icon: extend the yellow/orange background naturally into the four corners so the complete square is filled; remove only the pale gray outside canvas/shadow and the baked-in rounded corner clipping. Preserve the full three dogs and lettering comfortably within the central 80 percent of the canvas, with a little extra yellow/orange breathing room on all sides. Keep the original charming cartoon style and original composition. No additional objects, no extra text, no borders, no drop shadow outside the square. This is asset preparation of the supplied artwork, not a logo redesign.

### Transparent mascots

> Use case: background-extraction. Asset type: Android adaptive app icon transparent foreground, square PNG. Edit target: the supplied PawScan AI artwork. Extract and preserve the same exact three adorable cartoon dogs as a single group: left orange-and-white corgi, center golden retriever, right black-and-white blue-eyed husky. Preserve their poses, faces, outlines and warm shading. Remove all yellow/orange background, all shadows outside the dogs, all gray outer canvas, and all lettering. The output must have real alpha transparency. Put the complete three-dog group centered in a generously padded square canvas, with all character pixels inside the central 60 percent of the canvas width AND height, so none can be clipped by Android circular or squircle icon masks. Leave the outer 20 percent on each side completely transparent. Keep every ear, paw and tail visible. No text, no new elements, no rounded square container, no background color. This is an adaptive foreground derived faithfully from the user's logo.

The generated mascot composition received additional padding in the platform
export so its visible pixels fit the Android safe area.
