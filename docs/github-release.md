# GitHub Release Workflow

## Overview

The release workflow automatically builds an Android APK and creates a GitHub Release when you push a version tag.

**Workflow file:** `<repo-root>/.github/workflows/release.yml` (at the repository root, not inside `ionic-app/`)

## How to Create a Release

### Step 1: Update version numbers

Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 2          // Increment this (integer)
    versionName "1.1.0"    // Human-readable version
}
```

Optionally update `package.json`:
```json
{
  "version": "1.1.0"
}
```

### Step 2: Commit your changes

```bash
git add -A
git commit -m "Release v1.1.0"
```

### Step 3: Create and push a tag

```bash
git tag v1.1.0
git push origin main
git push origin v1.1.0
```

The workflow triggers automatically when the tag is pushed.

### Step 4: Monitor the build

Go to your repo's **Actions** tab to watch the build progress. It typically takes 3-5 minutes.

### Step 5: Check the release

Once complete, go to **Releases** in your repo. You'll find:
- `Mergex LeadGen-v1.1.0.apk` — ready to download and install on Android

## Tag Format

| Tag | Type |
|-----|------|
| `v1.0.0` | Stable release |
| `v1.1.0-beta` | Pre-release (marked automatically) |
| `v1.1.0-alpha` | Pre-release |
| `v1.1.0-rc.1` | Release candidate (pre-release) |

Tags with `beta`, `alpha`, or `rc` are automatically marked as pre-release.

## Manual Trigger

You can also trigger a release manually:
1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Enter the tag name (e.g., `v1.0.0`)
4. Click **Run**

## What the Workflow Does

```
Tag pushed (v*)
    │
    ▼
Job 1: build-android (ubuntu-latest)
    ├── Checkout code
    ├── Setup Node.js 20
    ├── Setup JDK 21 (required by AGP 8.13.0)
    ├── Setup Android SDK
    ├── npm ci (install dependencies)
    ├── vite build (web assets → dist/)
    ├── cap sync android (sync to native project)
    ├── gradlew assembleRelease (build APK)
    └── Upload APK artifact
    │
    ▼
Job 2: release (ubuntu-latest)
    ├── Download APK artifact
    ├── Rename to Mergex LeadGen-v1.0.0.apk
    └── Create GitHub Release with APK attached
```

## Requirements

- Repository must have **Actions** enabled
- Default `GITHUB_TOKEN` permissions must include `contents: write` (this is set in the workflow)
- No signing key needed — builds unsigned release APK

## Troubleshooting

### Build fails at Gradle step
- Check that `ionic-app/android/` folder is committed to the repo
- Ensure `ionic-app/android/gradle/wrapper/gradle-wrapper.jar` is committed (not in `.gitignore`)
- The workflow sets `working-directory: ionic-app` — all commands run inside that folder

### No APK in release
- Check the Actions log for the "Locate APK" step
- Ensure `android/app/build.gradle` has `release` build type configured

### Tag not triggering workflow
- Tag must start with `v` (e.g., `v1.0.0`)
- Push the tag separately: `git push origin v1.0.0`
- Check that the workflow file is on the default branch (main/master)

## iOS Note

iOS builds require macOS runners and Apple code signing certificates. To add iOS:
1. Use `runs-on: macos-latest`
2. Set up Xcode and code signing
3. Build with `xcodebuild`
4. This requires an Apple Developer account ($99/year) and provisioning profiles

The current workflow only builds Android since it can run on free `ubuntu-latest` runners with no signing required.
