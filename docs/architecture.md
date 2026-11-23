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

## Key Architecture Decision: 100% Client-Side Architecture (No Backend)

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
scraper.js: search(query, mode, onProgress, resumeState)
    │
    ├── Check local cache (24h TTL)
    │   │
    │   Yes ─── Return cached results
    │   │
    │   No
    │   │
    ├── fetch() → Google Search HTML
    │       (native HTTP on Android/iOS, bypasses CORS)
    │
    ├── DOMParser → Parse HTML response
    │
    ├── CSS Selectors → Extract place data (.VkpGBb containers, data-cid, etc.)
    │
    ├── libphonenumber-js → Validate phone numbers
    │
    ├── Pagination → Loop until no more results (10 per page)
    │
    ├── Phase 2: CID lookup (if mode !== 'fast' and phones missing)
    │
    └── Return deduplicated results array + resumeState (if paused)
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
        │   ├── Hero section (branding)
        │   ├── Search input + button
        │   ├── Mode selector (Fast/Auto/Deep)
        │   ├── Action buttons (Generate/Pause)
        │   └── Search tags (quick suggestions)
        │
        ├── Results View
        │   ├── Toolbar (results count + Export/Open/Share)
        │   ├── Filter bar (search + sort controls)
        │   ├── Result cards (clickable → detail modal)
        │   └── Detail modal (phone, maps, website actions)
        │
        ├── History View
        │   ├── Search bar (filter)
        │   ├── History list (tap to load, play to resume, trash to delete)
        │   └── Pull to refresh
        │
        ├── Settings View
        │   ├── Clear local cache
        │   ├── Notification permissions
        │   └── About (version)
        │
        ├── Modals
        │   ├── Info modal (about, contact, links)
        │   ├── Mode modal (mode details + recommendations)
        │   └── Detail modal (business actions)
        │
        └── Footer Tabs
            ├── Search tab
            ├── History tab
            └── Settings tab
```

## Service Files

### `src/services/scraper.js`

Main scraping service with:
- `search(query, mode, onProgress, resumeState)` — Main entry point
- `fetchit(url)` — Fetches and parses Google Search HTML
- `fetchExtraDetails(query, cid)` — Fetches extra details via Google's async endpoint
- `extractContactInfoBulletproof(rawPayload)` — Parses contact info from raw payload
- `extractPhone(text)` — Extracts phone number from text
- `dedup(list)` — Deduplicates results by CID or title+address

Supports three modes:
- **fast**: Scrapes search pages only, no phone lookup
- **normal**: Fills missing phones via CID lookup
- **long**: Enriches ALL results with extra details

Supports pause & resume via `resumeState` object.

### `src/services/excel.js`

Excel export service:
- `makeExcel(data, query)` — Generates .xlsx file
- `saveToDownloads(data, query)` — Saves to Downloads folder (native)
- `shareLastFile(filename)` — Shares via system share sheet
- `getLastSavedUri()` — Returns last saved file URI

## Native Plugin Usage

| Plugin | Purpose |
|--------|---------|
| `CapacitorHttp` | Patches fetch() to use native HTTP, bypassing CORS |
| `@capacitor/filesystem` | Save Excel files to device Downloads folder |
| `@capacitor/share` | Share exported files with other apps |
| `@capacitor/local-notifications` | Notify when search/download completes |
| `@capawesome-team/capacitor-android-foreground-service` | Keep scraping alive when app is backgrounded |

## Local Cache

The app maintains a local cache for offline access:
- **Cache key**: `mergex_cache_[hash]`
- **TTL**: 24 hours
- **Max entries**: 20 (LRU eviction)

Uses simple hash function (not cryptographic) for key generation.

## Search Modes Summary

| Mode | Speed | Data Completeness | Phone Lookup |
|------|-------|------------------|-------------|
| Fast | Fastest (~5s/200) | Basic (names, addresses, ratings, websites) | None |
| Auto | Medium (~10-20s/200) | Good (fills missing phones) | On-demand |
| Deep | Slowest (~20-30s/200) | Best (full details) | Always |