# Build & Deploy

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (browser, warns about CORS) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run build:android` | Build + sync to Android project |
| `npm run build:ios` | Build + sync to iOS project |
| `npm run run:android` | Build + sync + open Android Studio |
| `npm run run:ios` | Build + sync + open Xcode |
| `npm run export:android` | Build debug APK |
| `npm run export:android:release` | Build unsigned release APK |
| `npm run export:ios` | Build + open Xcode for archive |
| `npm run test:unit` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Cypress) |
| `npm run lint` | Run ESLint |

## Build Pipeline

### Web Build

```bash
npm run build
```

Outputs optimized static files to `dist/`. Uses Vite with:
- Vue SFC compilation
- Legacy browser support (IE11 via `@vitejs/plugin-legacy`)
- Terser minification
- Path alias: `@/` → `src/`

### Android Build

#### Debug APK

```bash
npm run export:android
```

Pipeline: `vite build` → `cap sync android` → `gradlew assembleDebug`

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Install directly on device:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

#### Release APK (Unsigned)

```bash
npm run export:android:release
```

Output: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

To sign for Play Store distribution, you need to configure signing in `android/app/build.gradle`.

#### Run on Device via Android Studio

```bash
npm run run:android
```

Opens Android Studio. Select your device and click Run.

### iOS Build

```bash
npm run run:ios
```

Opens Xcode. To create an IPA:
1. Select your device/simulator
2. Product → Archive
3. Distribute App → select distribution method

Requires Apple Developer account and code signing certificates.

## Syncing Changes

After modifying web code, always sync before running on device:

```bash
# Just sync (no build)
npx cap sync android
npx cap sync ios

# Build + sync
npm run build:android
npm run build:ios
```

## Common Build Issues

### Stale Build on Device
If your code changes aren't reflected on the device, rebuild:
```bash
npm run build:android
```
Then rebuild the APK in Android Studio. Check the `dist/` folder timestamp to confirm a fresh build.

### Gradle Build Fails
```bash
cd android && ./gradlew clean && cd ..
npm run build:android
```

### Capacitor Sync Issues
```bash
npx cap sync android --force
```
