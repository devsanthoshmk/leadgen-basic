# Getting Started

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **Android Studio** (for Android builds)
- **Xcode** (for iOS builds, macOS only)
- **Java JDK 17** (for Android Gradle builds)

## Installation

```bash
cd ionic-app
npm install
```

## Running in Browser

```bash
npm run dev
```

Opens at `http://localhost:8100`. Note: Google scraping won't work in the browser due to CORS restrictions. The Capacitor native HTTP plugin only bypasses CORS on actual devices.

## Running on Android

### First Time Setup

```bash
# Add Android platform (already done if android/ folder exists)
npx cap add android

# Build web assets and sync to Android
npm run build:android
```

### Run on Device/Emulator

```bash
# Build, sync, and open Android Studio
npm run run:android
```

Then click the Run button in Android Studio to deploy to a connected device or emulator.

### Quick APK Build

```bash
# Debug APK (no signing needed)
npm run export:android

# Output: android/app/build/outputs/apk/debug/app-debug.apk
```

## Running on iOS

```bash
# Add iOS platform (macOS only)
npx cap add ios

# Build and open Xcode
npm run run:ios
```

In Xcode, select your device/simulator and click Run.

## Project Structure

```
ionic-app/
├── android/                    # Android native project
├── docs/                       # Documentation
├── public/                     # Static assets
│   ├── favicon.svg             # App favicon (SVG)
│   └── favicon.png             # App favicon (PNG fallback)
├── src/
│   ├── views/
│   │   └── HomePage.vue        # Main (and only) page
│   ├── services/
│   │   ├── scraper.js          # Google Places scraper
│   │   └── excel.js            # Excel export service
│   ├── router/
│   │   └── index.ts            # Vue Router config
│   ├── theme/
│   │   └── variables.css       # Ionic theme variables
│   ├── App.vue                 # Root Vue component
│   └── main.ts                 # App entry point
├── capacitor.config.ts         # Capacitor configuration
├── vite.config.ts              # Vite build configuration
├── index.html                  # HTML entry point
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── ionic.config.json           # Ionic CLI configuration
```
