# Troubleshooting

## CORS Errors in Browser

**Problem:** Scraping doesn't work when running `npm run dev` in a browser.

**Reason:** Browser enforces CORS. Google blocks cross-origin requests.

**Solution:** This is expected. The app is designed to run on Android/iOS where Capacitor's native HTTP bypasses CORS. Use a device or emulator for testing scraping functionality.

## Notifications Not Showing (Android)

**Checklist:**

1. **Rebuild after code changes:**
   ```bash
   npm run build:android
   ```
   Then rebuild APK in Android Studio. A stale build is the most common cause.

2. **Check permissions:** Look for `[NOTIF]` log lines in Android Studio Logcat. Filter by your app package.

3. **Notification channel exists:** The app creates a "Search Updates" channel on startup. Check Settings → Apps → GlobexData → Notifications.

4. **Android 13+:** `POST_NOTIFICATIONS` permission must be granted at runtime. The app requests this on startup.

5. **Notification icon exists:** `ic_notification.xml` must exist in `android/app/src/main/res/drawable/`. A missing icon silently crashes notifications on Android.

6. **Do Not Disturb:** Check that DND mode isn't blocking notifications.

## Search Returns No Results

**Possible Causes:**

1. **Rate limiting:** Google may temporarily block requests. Wait a few minutes and try again.

2. **Query format:** Use specific queries like "restaurants in [city]" or "hotels near [location]".

3. **Network issues:** Check device has internet connectivity.

4. **Google HTML changes:** If Google changes their search result HTML structure, the CSS selectors in `scraper.js` (`.VkpGBb`, `.rllt__details`) may need updating.

## Excel Download Issues

### Android: File Not Found in Downloads

- Check app has storage permissions (Settings → Apps → GlobexData → Permissions)
- On Android 11+, files are saved via scoped storage — check the Downloads folder specifically

### Web: Download Doesn't Start

- Check browser's download settings
- Try a different browser
- Ensure popup/download blockers aren't interfering

## Foreground Service Not Starting

**Problem:** App stops scraping when backgrounded on Android.

**Checklist:**

1. `FOREGROUND_SERVICE` permission in AndroidManifest.xml
2. `FOREGROUND_SERVICE_DATA_SYNC` permission in AndroidManifest.xml
3. `@capawesome-team/capacitor-android-foreground-service` installed
4. Battery optimization may kill the service — exempt the app in Settings → Battery

## Build Errors

### "vue-tsc" Errors

The build script uses `vite build` (without `vue-tsc`). If you see TypeScript errors, they won't block the build.

### Gradle Errors

```bash
cd android && ./gradlew clean && cd ..
npm run build:android
```

### "capacitor.config.ts not found"

Make sure you're running commands from the `ionic-app/` directory, not the project root.

## Phone Number Not Detected

The scraper uses `libphonenumber-js` to validate phone numbers. If a phone number isn't being picked up:

- The number format may not match the regex pattern
- The number may fail validation (not a real phone number format)
- Google may display the number in an unexpected location in the HTML

## App Icon Shows Default Android Robot

Rebuild after icon changes:
```bash
cd android && ./gradlew clean && cd ..
npm run build:android
```

The custom icon files are in:
- `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`
- `android/app/src/main/res/drawable/ic_launcher_background.xml`
