# Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| UI Framework | Ionic Vue | 8.0.0 |
| Frontend | Vue 3 | 3.3.0 |
| Routing | Vue Router | 4.2.0 |
| Build Tool | Vite | 5.0.0 |
| Mobile Runtime | Capacitor | 8.2.0 |
| Icons | Ionicons | 7.0.0 |
| Excel Generation | write-excel-file | 3.0.6 |
| Phone Parsing | libphonenumber-js | 1.12.40 |

## Key Architecture Decision: No Backend

This app has **no backend server**. Everything runs locally inside the app:

- **Scraping** happens client-side using `fetch()` + `DOMParser`
- **Excel generation** happens in-browser using `write-excel-file/browser`
- **File saving** uses Capacitor's Filesystem plugin on native platforms

This is possible because Capacitor's `CapacitorHttp` plugin patches `window.fetch` on native platforms to use the device's native HTTP stack, which **bypasses CORS restrictions**.

## Data Flow

```
User Input (search query)
    │
    ▼
scraper.js: search(query)
    │
    ├── fetch() → Google Search HTML
    │       (native HTTP on Android/iOS, bypasses CORS)
    │
    ├── DOMParser → Parse HTML response
    │
    ├── CSS Selectors → Extract place data
    │       (.VkpGBb containers, .rllt__details metadata)
    │
    ├── libphonenumber-js → Validate phone numbers
    │
    ├── Pagination → Loop until no more results
    │
    └── Return deduplicated results array
            │
            ▼
    HomePage.vue: Display results
            │
            ├── Filter (text search across all fields)
            ├── Sort (name, stars, reviews, category)
            └── Detail modal (phone, maps, website actions)
            │
            ▼
    excel.js: makeExcel(data, query)
            │
            ├── write-excel-file → Generate .xlsx blob
            │
            ├── [Native] Filesystem.writeFile → Save to Downloads
            │   └── LocalNotifications → "Download Complete"
            │
            └── [Web] Blob URL → Browser download
```

## Component Architecture

```
App.vue
└── ion-router-outlet
    └── HomePage.vue (single page app)
        ├── Search View
        │   ├── Header ("Mergex LeadGen" branding)
        │   ├── Search input + button
        │   └── Footer (social links)
        │
        └── Results View
            ├── Header (back button + download/share buttons)
            ├── Filter bar (search + sort controls)
            ├── Result cards (clickable → detail modal)
            ├── Detail modal (phone, maps, website actions)
            └── Footer (social links)
```

## Native Plugin Usage

| Plugin | Purpose |
|--------|---------|
| `CapacitorHttp` | Patches fetch() to use native HTTP, bypassing CORS |
| `@capacitor/filesystem` | Save Excel files to device Downloads folder |
| `@capacitor/share` | Share exported files with other apps |
| `@capacitor/local-notifications` | Notify when search/download completes |
| `@capawesome-team/capacitor-android-foreground-service` | Keep scraping alive when app is backgrounded |

## Dependency Graph

```
HomePage.vue
├── src/services/scraper.js
│   └── libphonenumber-js
├── src/services/excel.js
│   ├── write-excel-file/browser
│   ├── @capacitor/filesystem
│   ├── @capacitor/share
│   └── @capacitor/local-notifications
├── @capacitor/core (platform detection)
├── @capacitor/local-notifications (search complete)
├── @capawesome-team/capacitor-android-foreground-service
└── @ionic/vue (UI components)
```
