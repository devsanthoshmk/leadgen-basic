# Mergex LeadGen - Places Data App

A cross-platform mobile and web application that scrapes Google Places data and exports it to Excel. Built with Ionic Vue + Capacitor.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Getting Started](./getting-started.md) | Installation, setup, and running the app |
| [Architecture](./architecture.md) | App structure, tech stack, data flow |
| [Features](./features.md) | Complete feature reference |
| [Services API](./services-api.md) | Scraper and Excel service documentation |
| [Android Configuration](./android-config.md) | Permissions, manifest, icons, foreground service |
| [Build & Deploy](./build-deploy.md) | Building APKs, running on devices, scripts |
| [Releasing](./releasing.md) | How to tag, release, and publish APKs |
| [GitHub Release](./github-release.md) | CI/CD workflow technical details |
| [Troubleshooting](./troubleshooting.md) | Common issues and fixes |

## Quick Start

```bash
# Install dependencies
npm install

# Run in browser (CORS limited)
npm run dev

# Build and run on Android
npm run run:android

# Export debug APK
npm run export:android
```

## App Overview

**Mergex LeadGen** lets users search for businesses/places, view detailed results with filtering and sorting, and export the data to Excel spreadsheets.

### How It Works

1. User enters a search query (e.g., "restaurants in Chennai")
2. App scrapes Google Search results using native HTTP (bypasses CORS on mobile)
3. Parses business data: name, rating, reviews, phone, address, website
4. Displays results as interactive cards with filter/sort
5. User can export all data to `.xlsx` Excel file
6. On Android: file saved to Downloads with notification + share option

### Platforms

- **Android** — Full functionality (scraping, notifications, background service, file export)
- **iOS** — Full functionality (requires macOS + Xcode for building)
- **Web Browser** — UI works, but scraping is blocked by CORS (no native HTTP bypass)
