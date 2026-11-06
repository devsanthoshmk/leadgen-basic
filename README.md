# LeadGen basic

LeadGen basic is a cross-platform B2B lead generation tool and Google Maps lead generation scraper. The application runs on Android, iOS, and desktop web browsers. It extracts business names, phone numbers, addresses, ratings, and websites directly from local search results without third-party scraping APIs or headless browser overhead. The codebase also provides the foundation for a multi-source lead scraper with planned integrations such as a fast LinkedIn search scraper.

## Purpose

LeadGen basic collects structured B2B contact lists for sales teams, agencies, and local market researchers. The software performs zero-render HTTP requests and parses raw HTML directly on the user device.

Primary capabilities:
- Google Maps lead generation through Google Local Search queries.
- Extraction of business names, review counts, star ratings, categories, full physical addresses, websites, and verified phone numbers.
- Contact enrichment using Google CID lookups for listings that omit phone numbers on initial search pages.
- Spreadsheet generation producing seven-column .xlsx workbooks.
- Mobile background execution with Android foreground services and local notifications.
- Local cache with 24-hour persistence and optional cloud synchronization through Cloudflare D1.
- Extensible pipeline designed to support multi-source lead scraper adapters, including a fast LinkedIn search scraper and web directory scrapers.

## Architecture

The system uses a client-heavy architecture. The client device executes all scraping, DOM parsing, deduplication, and file generation tasks. A serverless edge worker provides optional persistence.

```
Client runtime with Ionic Vue and Capacitor
  │
  ├── Scraper engine
  │     ├── Google Local Search page scraper using udm=1 parameter
  │     ├── Asynchronous CID contact lookup using XPath
  │     └── Phone normalization using libphonenumber-js
  │
  ├── Native bridge
  │     ├── CapacitorHttp native HTTP stack for CORS bypass
  │     ├── Android foreground service for background tasks
  │     └── MediaStore plugin for downloads folder storage
  │
  └── Storage and persistence
        ├── Local browser storage cache with 24-hour expiration
        └── Cloudflare Workers edge API with Cloudflare D1 SQLite database
```

### Scraping pipeline

The scraper service in `src/services/scraper.js` operates in two sequential phases:

1. Page parsing. The client sends HTTP requests to Google Search with the `udm=1` query parameter. This parameter forces Google to return local business listings. The engine parses `.VkpGBb` elements from the response body, extracting place titles, ratings, review totals, categories, and website links. It extracts physical addresses from Google Maps directions links.
2. Contact enrichment. When listings lack phone numbers, the engine queries the Google asynchronous detail endpoint at `/async/lcl_akp` using the unique customer ID, or CID. An XPath evaluator targets address and telephone nodes to extract complete phone records.

The pipeline normalizes phone numbers through `libphonenumber-js` and deduplicates records by CID in an ES6 Map.

### Core technologies

- Frontend. Vue 3.3 and Ionic Vue 8.0.
- Build tool. Vite 5.0 with legacy browser support.
- Mobile runtime. Capacitor 8.2 with CapacitorHttp native networking.
- Spreadsheet export. write-excel-file 3.0.
- Phone validation. libphonenumber-js 1.12.
- Backend API. Cloudflare Workers with TypeScript router.
- Edge database. Cloudflare D1 serverless SQLite.
- Native Android. Java MediaStore plugin and Android foreground service.

## Setup

### Prerequisites

Ensure the following tools are installed:
- Node.js version 18 or later
- npm version 9 or later
- Java Development Kit version 17, required for Android builds
- Android Studio with Android SDK command-line tools, required for Android builds
- Xcode version 15 or later, required for iOS builds on macOS

### Installation

Clone the repository and install root dependencies:

```bash
git clone https://github.com/devsanthoshmk/leadgen-basic.git
cd leadgen-basic
npm install
```

To run the optional edge backend, install worker dependencies:

```bash
cd worker
npm install
cd ..
```

### Development server

Start the Vite development server:

```bash
npm run dev
```

The interface opens at `http://localhost:8100`. Web browsers enforce CORS restrictions on direct Google Search requests. Complete scraping operations require the native mobile runtime or a CORS-disabled development environment.

### Mobile build

Compile web assets and synchronize native Android assets:

```bash
npm run build:android
```

Generate an unsigned debug APK:

```bash
npm run export:android
```

The APK outputs to `android/app/build/outputs/apk/debug/app-debug.apk`.

To launch the project in Android Studio:

```bash
npm run run:android
```

## Usage

### Search modes

The scraper provides three execution modes:

- Fast mode. Queries paginated search result pages only. It skips CID enrichment, maximizing collection speed for high-level business discovery.
- Auto mode, the default setting. Scrapes search result pages and evaluates phone coverage. If records lack phone numbers, the engine enriches them through CID lookups.
- Deep mode. Runs individual CID lookups for every discovered record, ensuring complete address and phone coverage.

### Spreadsheet export

Clicking Export converts the active result set into a Microsoft Excel .xlsx workbook. The export contains seven columns:
1. Name
2. Category
3. No. Of Reviews
4. Stars
5. Phone Number
6. Address
7. Place Website

On Android, the custom Java plugin writes the binary file directly to `MediaStore.Downloads.EXTERNAL_CONTENT_URI`. The app issues a local notification and opens the system share dialog. On desktop browsers, the app triggers a standard file download.

### Backend endpoints

The Cloudflare Worker in `worker/src/index.ts` exposes the following endpoints:

- `GET /health` returns service health status.
- `POST /searches` stores a search query and batch results.
- `GET /searches` lists historical searches with pagination.
- `GET /searches/:id` returns metadata and rows for a search.
- `DELETE /searches/:id` removes a search and its associated records.
- `GET /searches/match?q=&mode=` looks up exact matches for a query and mode.
- `GET /searches/similar?q=` finds past similar searches using SQL LIKE queries.
- `POST /resume` saves paused search state for cross-session continuation.
- `GET /resume?device_id=` retrieves paused search progress.

Protected routes require authentication via `Authorization: Bearer <token>` or `?password=<token>`.

## Configuration

### Environment variables

Create a `.env` file in the project root based on `.env.example`:

```env
VITE_API_URL=https://leadgen-api.sanpro.workers.dev
VITE_API_PASSWORD=mergex-leadgen
```

Variables:
- `VITE_API_URL` sets the base URL of the Cloudflare Worker API.
- `VITE_API_PASSWORD` sets the authentication token required by protected worker routes.

### Cloudflare Worker configuration

Configure `worker/wrangler.jsonc` before deployment:

```jsonc
{
  "name": "leadgen-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-04-06",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "leadgen-db",
      "database_id": "<your-d1-database-id>"
    }
  ]
}
```

Create the D1 database and deploy:

```bash
cd worker
npx wrangler d1 create leadgen-db
npm run deploy
```

## Documentation

The `docs` directory contains detailed technical guides:
- `docs/architecture.md` covers component layout and data flow diagrams.
- `docs/features.md` lists complete application capabilities.
- `docs/services-api.md` details scraper service and Excel export interfaces.
- `docs/TECHNICAL_DEEP_DIVE.md` details scraping mechanics and DOM extraction.
- `docs/android-config.md` outlines Android permissions, services, and notification channels.
- `docs/build-deploy.md` explains APK packaging and signing instructions.
- `docs/troubleshooting.md` addresses CORS handling, background service, and build resolutions.
