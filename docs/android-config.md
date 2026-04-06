# Android Configuration

## App Identity

| Property | Value |
|----------|-------|
| App ID | `in.mergex.leadgen` |
| App Name | Mergex LeadGen |
| Min SDK | Default (Capacitor 8 sets API 22) |
| Target SDK | Default (Capacitor 8 sets latest) |

## Permissions

Declared in `android/app/src/main/AndroidManifest.xml`:

| Permission | Purpose | Notes |
|-----------|---------|-------|
| `INTERNET` | HTTP requests for scraping | Required |
| `WRITE_EXTERNAL_STORAGE` | Save Excel files | Android < 11 only (`maxSdkVersion=29`) |
| `READ_EXTERNAL_STORAGE` | Access files | Android < 13 only (`maxSdkVersion=32`) |
| `POST_NOTIFICATIONS` | Local notifications | Android 13+ (runtime permission) |
| `SCHEDULE_EXACT_ALARM` | Notification scheduling | Android 12+ |
| `FOREGROUND_SERVICE` | Background scraping | Required for foreground service |
| `FOREGROUND_SERVICE_DATA_SYNC` | Data sync service type | Specific foreground service type |

## Notification Setup

### Channel Configuration

Created at app startup in `HomePage.vue`:

```javascript
{
  id: 'search-updates',
  name: 'Search Updates',
  description: 'Notifications when search completes',
  importance: 5,        // MAX importance
  visibility: 1,        // PUBLIC
  vibration: true
}
```

### Notification Icon

**File:** `android/app/src/main/res/drawable/ic_notification.xml`

White checkmark circle vector drawable (24dp). Referenced in `capacitor.config.ts`:

```typescript
LocalNotifications: {
  smallIcon: 'ic_notification',
  iconColor: '#488AFF',
}
```

### Permission Flow

1. App checks `LocalNotifications.checkPermissions()` on mount
2. If not granted, requests via `LocalNotifications.requestPermissions()`
3. Android 13+ shows system permission dialog
4. Channel created after permission granted

## App Icon

### Foreground

**File:** `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`

Custom vector drawable: white location pin with blue magnifying glass containing data bars.

### Background

**File:** `android/app/src/main/res/drawable/ic_launcher_background.xml`

Solid blue (`#1A73E8`) background.

### Adaptive Icon

**File:** `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`

Uses adaptive icon format (foreground + background layers) for Android 8+. Pre-rendered PNGs exist in `mipmap-mdpi` through `mipmap-xxxhdpi` for older Android versions.

## Foreground Service

Uses `@capawesome-team/capacitor-android-foreground-service` to keep scraping alive when the app is backgrounded.

**Configuration in HomePage.vue:**
```javascript
await ForegroundService.startForegroundService({
  id: 1,
  title: 'Mergex LeadGen',
  body: 'Searching for places data...',
  smallIcon: 'ic_notification',
});
```

Automatically stopped when search completes or fails.

## Capacitor Config

**File:** `capacitor.config.ts`

```typescript
{
  appId: 'in.mergex.leadgen',
  appName: 'Mergex LeadGen',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: { enabled: true },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#488AFF',
    },
  },
}
```

`CapacitorHttp: { enabled: true }` — This is the critical setting that patches `window.fetch` to use native HTTP on Android/iOS, bypassing CORS restrictions.
