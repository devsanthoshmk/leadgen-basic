# Releasing a New Version

## Quick Reference

```bash
# 1. Make sure all changes are committed
git add -A
git commit -m "your changes"

# 2. Create a version tag
git tag v1.0.0

# 3. Push code and tag together
git push origin main --tags
```

That's it. The GitHub Actions workflow triggers automatically and publishes the APK to GitHub Releases.

---

## Step-by-Step Guide

### Step 1: Finish Your Changes

Make sure all your code changes are committed:
```bash
git status
git add -A
git commit -m "Add new feature / Fix bug / etc"
```

### Step 2: Choose a Version Number

Follow [Semantic Versioning](https://semver.org/):

| Change Type | Example | When to use |
|-------------|---------|-------------|
| Major | `v2.0.0` | Breaking changes, major rewrites |
| Minor | `v1.1.0` | New features, no breaking changes |
| Patch | `v1.0.1` | Bug fixes only |
| Pre-release | `v1.1.0-beta` | Testing before stable release |

### Step 3: (Optional) Update Version in Code

Edit `android/app/build.gradle`:
```gradle
defaultConfig {
    versionCode 2          // Increment by 1 each release (integer, must always go up)
    versionName "1.1.0"    // Human-readable version string
}
```

Edit `package.json`:
```json
{
  "version": "1.1.0"
}
```

Commit these changes:
```bash
git add android/app/build.gradle package.json
git commit -m "Bump version to v1.1.0"
```

### Step 4: Create and Push a Tag

```bash
# Create the tag
git tag v1.1.0

# Push everything (code + tag)
git push origin main --tags
```

Or push separately:
```bash
git push origin main
git push origin v1.1.0
```

### Step 5: Monitor the Build

1. Go to your GitHub repo
2. Click the **Actions** tab
3. You'll see the "Release" workflow running
4. Wait 3-5 minutes for it to complete

### Step 6: Find Your Release

1. Go to your GitHub repo
2. Click **Releases** (right sidebar or Code tab)
3. The latest release will have `Mergex LeadGen-v1.1.0.apk` attached
4. Download and install on Android

---

## Triggering a Release Manually

If you want to create a release without pushing a tag (e.g., re-run a failed build):

1. Go to **Actions** tab in your GitHub repo
2. Click **Release** workflow on the left
3. Click **Run workflow** button (top right)
4. Enter the tag name (e.g., `v1.0.0`)
5. Click **Run workflow**

---

## Tag Management

### List all tags
```bash
git tag
```

### Delete a tag (if you made a mistake)
```bash
# Delete locally
git tag -d v1.0.0

# Delete from GitHub
git push origin --delete v1.0.0
```

### Create a tag for a past commit
```bash
git tag v1.0.0 abc1234
git push origin v1.0.0
```

### See what commit a tag points to
```bash
git show v1.0.0
```

---

## Pre-releases

Tags containing `beta`, `alpha`, or `rc` are automatically marked as pre-release on GitHub:

```bash
git tag v1.1.0-beta
git push origin v1.1.0-beta
# → Creates a pre-release (not shown as "Latest")

git tag v1.1.0
git push origin v1.1.0
# → Creates a stable release (shown as "Latest")
```

---

## What Happens Behind the Scenes

When you push a tag starting with `v`:

```
git push origin v1.0.0
        │
        ▼
GitHub detects tag push → triggers .github/workflows/release.yml
        │
        ▼
Job 1: build-android
  ├── Checkout code
  ├── Setup Node.js 22 + JDK 21
  ├── Setup Android SDK
  ├── npm ci (install dependencies)
  ├── vite build (web assets → dist/)
  ├── cap sync android
  ├── If signing secrets exist → signed release APK
  │   └── zipalign + apksigner
  ├── If no signing secrets → debug APK fallback
  └── Upload APK as artifact
        │
        ▼
Job 2: release
  ├── Download APK artifact
  ├── Rename to Mergex LeadGen-v1.0.0.apk
  └── Create GitHub Release with APK attached
```

---

## Signing (Optional)

Without signing secrets, the workflow builds a **debug APK** (installable but shows "untrusted" on some devices).

To enable signed releases, add these secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias name |
| `ANDROID_KEY_PASSWORD` | Key password |

### Generate a keystore
```bash
keytool -genkey -v -keystore release.keystore -alias mergex-leadgen -keyalg RSA -keysize 2048 -validity 10000
```

### Convert to base64 for GitHub secret
```bash
base64 -w 0 release.keystore
# Copy the output → paste into ANDROID_KEYSTORE_BASE64 secret
```

---

## Troubleshooting

### Workflow didn't trigger
- Tag must start with `v` (e.g., `v1.0.0`, not `1.0.0`)
- Make sure you pushed the tag: `git push origin v1.0.0`
- The workflow file must exist on the default branch (main/master)

### Build failed
- Check the **Actions** tab for error logs
- Common fix: ensure `ionic-app/android/gradle/wrapper/gradle-wrapper.jar` is committed

### Tag already exists
```bash
# Delete and recreate
git tag -d v1.0.0
git push origin --delete v1.0.0
git tag v1.0.0
git push origin v1.0.0
```

### Want to re-release the same version
Delete the tag and the GitHub release, then push the tag again:
```bash
git push origin --delete v1.0.0
git tag -d v1.0.0
# Delete the release from GitHub Releases page too
git tag v1.0.0
git push origin v1.0.0
```
