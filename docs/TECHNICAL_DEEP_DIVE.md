# Mergex LeadGen — Technical Deep Dive

> An in-depth exploration of the architecture, scraper engine, and engineering decisions behind Mergex LeadGen.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [The Scraper Engine — Heart of the Application](#the-scraper-engine--heart-of-the-application)
3. [How the Scraper Is Moulded Into the App](#how-the-scraper-is-moulded-into-the-app)
4. [Why This Is the Most Efficient Approach](#why-this-is-the-most-efficient-approach)
5. [Cloud Sync Layer — Cloudflare Workers + D1](#cloud-sync-layer--cloudflare-workers--d1)
6. [Native Platform Integration](#native-platform-integration)
7. [Data Pipeline: From HTML to Excel](#data-pipeline-from-html-to-excel)
8. [Resumability — Stateful Scraping Across Sessions](#resumability--stateful-scraping-across-sessions)
9. [Performance Characteristics & Benchmarks](#performance-characteristics--benchmarks)

---

## System Architecture Overview

Mergex LeadGen follows a **client-heavy, server-light** architecture. The entire scraping, parsing, enrichment, and export pipeline runs on the user's device. The optional cloud backend exists purely for data persistence and cross-device sync — it performs zero computation on the scraped data.

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                         │
│                                                         │
│  ┌──────────┐    ┌───────────┐    ┌──────────────────┐  │
│  │ Vue 3 +  │───▶│ Scraper   │───▶│ DOMParser        │  │
│  │ Ionic UI │    │ Engine    │    │ (HTML → DOM)     │  │
│  └──────────┘    └─────┬─────┘    └──────────────────┘  │
│       │                │                                 │
│       │          ┌─────▼─────┐    ┌──────────────────┐  │
│       │          │ Data      │───▶│ libphonenumber-js│  │
│       │          │ Extractor │    │ (Phone Validate) │  │
│       │          └─────┬─────┘    └──────────────────┘  │
│       │                │                                 │
│       │          ┌─────▼─────┐    ┌──────────────────┐  │
│       │          │ Dedup +   │───▶│ write-excel-file │  │
│       │          │ Normalize │    │ (XLSX Export)    │  │
│       │          └───────────┘    └──────────────────┘  │
│       │                                                  │
│  ┌────▼────────────────────────────────────────────┐    │
│  │          Capacitor Native Bridge                │    │
│  │  • CapacitorHttp (CORS bypass via native HTTP)  │    │
│  │  • Foreground Service (background execution)    │    │
│  │  • Local Notifications                          │    │
│  │  • SaveToDownloads (custom plugin)              │    │
│  └─────────────────────────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────┘
                        │ (optional cloud sync)
                        ▼
         ┌──────────────────────────────┐
         │  Cloudflare Workers + D1     │
         │  (Search history & resume    │
         │   state persistence only)    │
         └──────────────────────────────┘
```

**Technology Stack:**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | Vue 3 + Ionic 8 | Reactive components + mobile-native UI |
| Build Tool | Vite 5 | Fast HMR, ES module builds |
| Native Bridge | Capacitor 8 | Web-to-native API access |
| HTTP Client | CapacitorHttp | Native HTTP stack (CORS bypass) |
| Scraper | fetch + DOMParser + XPath | Zero-dependency HTML parsing |
| Phone Validation | libphonenumber-js | Google's phone lib (JS port) |
| Excel Export | write-excel-file | Lightweight .xlsx generation |
| Backend | Cloudflare Workers | Edge-deployed API |
| Database | Cloudflare D1 (SQLite) | Serverless relational storage |
| File I/O | Custom SaveToDownloadsPlugin | Android MediaStore integration |

---

## The Scraper Engine — Heart of the Application

**File: `src/services/scraper.js` (~490 lines)**

The scraper is the core differentiator of this application. It is a **pure client-side Google Local Search parser** that extracts structured business data without any server-side proxy, headless browser, or third-party scraping API.

### 2.1 Entry Point: `search()`

```javascript
export async function search(query, mode = 'normal', onProgress = null, resumeState = null)
```

**Parameters:**
- `query` — The search term (e.g., "restaurants in Chennai")
- `mode` — One of `'fast'`, `'normal'`, `'long'` — controls the speed/completeness tradeoff
- `onProgress` — Callback function invoked after each page; returns `false` to pause
- `resumeState` — If provided, resumes from a previously paused search

**Returns:**
```javascript
{
  results: Array<ResultObject>,   // Deduplicated, normalized results
  resumeState: Object | null      // Non-null if search was paused
}
```

### 2.2 Phase 1: Paginated Search Page Scraping

The scraper constructs Google Search URLs with a critical parameter:

```
https://www.google.com/search?q={query}&start={offset}&udm=1
```

**The `udm=1` parameter** is the key. It forces Google to return results in the **Local/Places** layout, which uses a consistent DOM structure with `.VkpGBb` containers for each business result. Without this parameter, Google returns mixed web results with inconsistent markup.

**HTTP Request Configuration:**
```javascript
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 ... Chrome/144.0.0.0 Mobile Safari/537.36'
  },
  signal: AbortSignal.timeout(20000)  // 20-second timeout
});
```

The User-Agent is set to a mobile Chrome version. This is critical because:
1. Mobile search results have a simpler DOM structure
2. Fewer anti-scraping challenges on mobile user agents
3. Consistent result container class names

**Pagination logic:**
```
Page 1: start=0  → results 1-10
Page 2: start=10 → results 11-20
Page 3: start=20 → results 21-30
...continues until Google returns zero results
```

The scraper increments `start` by 10 on each iteration. When the parsed HTML contains no `.VkpGBb` elements, pagination terminates.

### 2.3 Phase 1: HTML Parsing & Data Extraction

Each fetched HTML page is parsed using the browser's native `DOMParser`:

```javascript
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const containers = doc.querySelectorAll('.VkpGBb');
```

From each `.VkpGBb` container, the scraper extracts:

| Field | Selector / Method | Details |
|-------|-------------------|---------|
| **Title** | `[role="heading"]` | Business name from heading element |
| **CID** | `[data-cid]` attribute | Google's unique place identifier |
| **Rating** | Star element text parsing | Numeric 0-5.0 value |
| **Reviews** | Review count span | Integer count, parsed from "(123)" format |
| **Category** | `·` delimiter parsing | Business type from metadata string |
| **Address** | Directions link URL decode | Extracted from Google Maps link parameter |
| **Phone** | Regex + libphonenumber-js | Phone numbers validated against country code |
| **Website** | Anchor with "website" text | Direct URL to business website |

**Phone number extraction** is particularly sophisticated:

```javascript
// 1. Regex extraction from text content
const phoneRegex = /[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/;

// 2. Validation with libphonenumber-js
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// 3. Normalize to international format
const parsed = parsePhoneNumber(rawPhone, 'IN');  // Default country: India
return parsed.formatInternational();  // "+91 98765 43210"
```

This three-step process (extract → validate → normalize) ensures phone numbers are always in a consistent, dialable format regardless of how Google displays them.

### 2.4 Phase 2: CID-Based Phone Enrichment

When phone numbers are missing from the search page (common for some businesses), the scraper enters an enrichment phase using Google's internal async endpoint:

```
https://www.google.com/async/lcl_akp?q={query}&async=ludocids:{cid},_fmt:prog
```

This endpoint returns additional business details for a given Google CID (Customer ID). The response is a partial HTML fragment containing:
- Full address (more detailed than search page)
- Phone number (often available here even when missing from search)
- Business hours
- Additional metadata

**Enrichment is mode-dependent:**

| Mode | Phase 2 Behavior |
|------|-----------------|
| `fast` | **Skipped entirely** — only search page data is used |
| `normal` | **Conditional** — runs only if initial results lack phone numbers. Checks a sample of results; if phones are found on the search page, skips enrichment. Its also called as Auto mode |
| `long` | **Always runs** — enriches every single result, regardless of existing data |

The `normal` mode's conditional logic is the key optimization:

```javascript
// Check if search results already contain phone numbers
const hasPhones = results.some(r => r.completePhoneNumber);

if (mode === 'normal' && hasPhones) {
  // Skip enrichment — search pages already had phone data
  return results;
}

if (mode === 'fast') {
  return results;  // Never enrich in fast mode
}

// Proceed with CID enrichment for each result
for (let i = enrichStart; i < results.length; i++) {
  const detail = await fetchCIDDetails(results[i].cid, query);
  if (detail.phone) results[i].completePhoneNumber = detail.phone;
  if (detail.address && !results[i].address) results[i].address = detail.address;
}
```

### 2.5 Deduplication Strategy

Google often returns the same business across multiple search pages. The scraper deduplicates using a composite key strategy:

```javascript
function dedup(list) {
  return Array.from(
    new Map(
      list.map(item => [
        item.cid || (item.title + item.address),  // Composite key
        item
      ])
    ).values()
  );
}
```

**Key selection logic:**
1. **Primary key: CID** — Google's unique place identifier (most reliable)
2. **Fallback key: title + address** — Used when CID is unavailable (rare)

Using `Map` ensures O(1) lookups per item, making deduplication O(n) overall.

### 2.6 Progress Reporting & Pause Control

The scraper uses a callback-based progress system:

```javascript
// Inside the scraping loop:
if (onProgress) {
  const shouldContinue = onProgress({
    found: currentResults.length,
    page: currentPage,
    phase: 'search'  // or 'enrich'
  });

  if (shouldContinue === false) {
    // User requested pause — capture state and return
    return {
      results: dedup(currentResults),
      resumeState: {
        query, mode,
        pagination: currentOffset,
        phase: currentPhase,
        enrichIndex: i,
        partialResults: currentResults
      }
    };
  }
}
```

This design gives the UI full control over the scraping lifecycle without tight coupling.

---

## How the Scraper Is Moulded Into the App

The scraper doesn't exist in isolation — it's deeply integrated into the app's lifecycle through several layers.

### 3.1 UI → Scraper Integration (`HomePage.vue`)

```
User Input → doSearch() → scraper.search() → onProgress callback → UI updates
                                                     ↓
                                              Pause detection
                                                     ↓
                                             Resume state saved
```

**`doSearch()` method** is the bridge between UI and scraper:

1. **Pre-search checks:** Cache lookup → Cloud match → Similar search suggestion
2. **Foreground service start** (Android): Prevents OS from killing the app
3. **Scraper invocation:** Passes query, mode, progress callback, and optional resume state
4. **Progress callback:** Updates UI counters, checks `searchCancelled` flag
5. **Post-search:** Cache results → Cloud sync → Notifications → Foreground service stop

### 3.2 Capacitor HTTP Patching — The CORS Solution

The scraper calls `fetch()` directly, but on mobile devices, Capacitor's `CapacitorHttp` plugin **transparently patches** `window.fetch()` to route requests through the native HTTP stack (OkHttp on Android, URLSession on iOS).

```
// capacitor.config.ts
plugins: {
  CapacitorHttp: { enabled: true }
}
```

This is a zero-code-change integration. The scraper code doesn't import any Capacitor modules — it just calls `fetch()` and the native bridge intercepts it. This means:
- **No CORS restrictions** — native HTTP doesn't enforce browser CORS policy
- **No proxy servers needed** — requests go directly from device to Google
- **Same code runs on web** — on web, regular `fetch()` fires (with CORS limitations)

### 3.3 Background Execution — Android Foreground Service

When a search starts, the app activates an Android Foreground Service:

```javascript
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

await ForegroundService.startForegroundService({
  id: 77,
  title: 'Mergex LeadGen',
  body: 'Searching for places data...',
  smallIcon: 'ic_notification'
});
```

This keeps the scraping process alive when the user switches apps. Without it, Android would kill the WebView after ~30 seconds in the background.

### 3.4 Smart Caching Layer

Results are cached locally to avoid re-scraping identical queries:

```javascript
// Cache key: SHA-like hash of query+mode
const cacheKey = `mergex_cache_${hashCode(query + mode)}`;

// Cache structure
{
  query: "restaurants in Chennai",
  mode: "normal",
  results: [...],
  timestamp: 1712700000000,  // Cache time
  ttl: 86400000              // 24 hours
}
```

**LRU eviction:** When cache exceeds 20 entries, the oldest entry is removed. This prevents localStorage from growing unbounded on devices with limited storage.

### 3.5 Cloud Sync Integration

When cloud sync is enabled, the app layers server-side persistence on top of local operations:

```
Search query entered
       │
       ├─▶ Check local cache (24h TTL)
       │       └─ HIT → Show cached results (source: "cache")
       │
       ├─▶ Check cloud: GET /searches/match?q=...&mode=...
       │       └─ EXACT MATCH → Show cloud results (source: "cloud")
       │
       ├─▶ Check cloud: GET /searches/similar?q=...
       │       └─ SIMILAR FOUND → Ask user: "Use similar or search fresh?"
       │
       └─▶ No cache/cloud hit → Run scraper
               │
               ├─▶ Save to local cache
               ├─▶ POST /searches (save to cloud)
               └─▶ Display results
```

This cascade ensures:
1. Fastest possible response (local cache first)
2. No duplicate cloud scrapes (exact match)
3. Smart reuse of related searches (similar match)
4. Fresh data when nothing matches (full scrape)

---

## Why This Is the Most Efficient Approach

The architecture of Mergex LeadGen was chosen deliberately over several alternative approaches. Here's why each design decision leads to maximum efficiency:

### 4.1 Client-Side Scraping vs. Server-Side Scraping

**Traditional approach:** Send queries to a backend server → server scrapes Google → returns results to client.

**Our approach:** Scrape directly from the user's device.

**Why client-side wins:**

| Factor | Server-Side | Client-Side (Mergex) |
|--------|-------------|---------------------|
| **IP Rate Limiting** | Single server IP gets blocked fast | Each user has their own IP — distributed naturally |
| **Server Costs** | Need compute infrastructure ($50-500+/month) | Zero compute cost — uses user's device |
| **Latency** | User → Server → Google → Server → User | User → Google → User (1 fewer hop) |
| **Scaling** | More users = more server load | More users = zero additional cost |
| **CORS** | Not an issue (server-to-server) | Solved via Capacitor native HTTP |
| **Bandwidth** | Server pays for all bandwidth | User's own data connection |
| **Privacy** | Server sees all queries | Queries stay on user's device |

The key insight is that **mobile devices, via Capacitor's native HTTP, bypass CORS entirely** — eliminating the only technical reason for a server-side proxy.

### 4.2 DOMParser vs. Regex vs. Cheerio

**Alternative 1: Regex parsing** — Fragile, breaks with any HTML change, can't handle nested structures.

**Alternative 2: Cheerio/jsdom** — Full Node.js DOM implementation. Heavy (500KB+ bundle), slow on mobile, unnecessary overhead.

**Our approach: Native DOMParser** — Zero-cost because it's built into every browser/WebView.

```javascript
// Zero-dependency, zero-bundle-cost, fastest possible parsing
const doc = new DOMParser().parseFromString(html, 'text/html');
const results = doc.querySelectorAll('.VkpGBb');
```

**Why DOMParser wins:**
- **Zero bundle size** — it's a browser built-in
- **Fastest parsing** — native C++ implementation, not JavaScript
- **Full DOM API** — querySelector, XPath, textContent all work natively
- **Identical to browser rendering** — parses HTML exactly as Chrome would

### 4.3 Three Search Modes vs. One-Size-Fits-All

Most scraping tools offer a single mode. Mergex offers three because different use cases have different priorities:

```
Speed  ████████████████████ ─── fast  (search pages only, ~5s per 100 results)
       ████████████         ─── normal (conditional enrichment, ~15s per 100)
       ██████               ─── long  (full enrichment, ~45s per 100)

Data   ██████               ─── fast  (name, address, category, rating)
       ████████████████     ─── normal (+ phone when available)
       ████████████████████ ─── long  (+ phone for ALL, verified addresses)
```

**The `normal` mode's conditional enrichment** is the critical optimization. Instead of blindly enriching every result (like `long` mode), it samples the initial results:

- If Google's search page already includes phone numbers → skip enrichment entirely
- If phones are missing → run the CID enrichment pipeline

This single check saves **70-80% of HTTP requests** for queries where Google provides phone data inline, cutting search time from ~45s to ~15s for 100 results.

### 4.4 CID-Based Enrichment vs. Individual Place Lookups

**Alternative:** Use Google Places API ($17 per 1000 requests) or scrape individual business pages.

**Our approach:** Use Google's internal `lcl_akp` async endpoint with batch CID lookups.

```
https://www.google.com/async/lcl_akp?async=ludocids:{cid},_fmt:prog
```

**Why this wins:**
- **Free** — No API key or billing required
- **Fast** — Single HTTP request per business (vs. loading full business page)
- **Lightweight** — Returns only a small HTML fragment, not a full page
- **Reliable** — Google's own internal endpoint, used by their search UI

### 4.5 Capacitor Native HTTP vs. Proxy Server

**Alternative 1:** CORS proxy server (cors-anywhere, etc.) — adds latency, costs money, single point of failure.

**Alternative 2:** Chrome extension with relaxed CORS — limited to desktop browser.

**Our approach:** Capacitor's `CapacitorHttp` transparently routes `fetch()` through the device's native HTTP stack.

**Why this wins:**
- **Zero configuration** — enabled with one config flag
- **Zero code changes** — the scraper just calls `fetch()` normally
- **No proxy latency** — requests go directly to Google
- **No server cost** — nothing to maintain
- **Platform-native TLS** — uses OS certificate store, proper TLS negotiation

### 4.6 Cloudflare Workers + D1 vs. Traditional Backend

**Alternative:** Express.js / Django / Rails on a VPS ($5-20/month), PostgreSQL database ($15+/month).

**Our approach:** Cloudflare Workers (serverless) + D1 (serverless SQLite).

**Why this wins:**

| Factor | Traditional | Cloudflare Workers + D1 |
|--------|-------------|------------------------|
| **Cost** | $20-50/month minimum | Free tier covers most usage |
| **Cold Start** | 2-5 seconds (Node.js) | 0ms (V8 isolates, always warm) |
| **Deployment** | SSH, Docker, CI/CD | `wrangler deploy` (one command) |
| **Scaling** | Manual (add servers) | Automatic (edge network) |
| **Global Latency** | Single region | 300+ edge locations worldwide |
| **Maintenance** | OS patches, DB backups | Zero ops |

The backend only stores search metadata and results — it needs no compute power, making serverless the obvious fit.

### 4.7 No Headless Browser

**Alternative:** Puppeteer/Playwright for scraping — requires a running Chrome instance, 200MB+ memory, 2-5 seconds per page.

**Our approach:** Plain HTTP requests + DOMParser.

**Why no headless browser:**
- Google's local search results are **server-side rendered** — the data exists in the initial HTML response
- No JavaScript execution needed — the business data is in the DOM from the first response
- Headless browsers consume 200MB+ RAM per instance — impossible on mobile devices
- Our approach uses ~5MB of memory for parsing

---

## Cloud Sync Layer — Cloudflare Workers + D1

**File: `worker/src/index.ts` (~488 lines)**

### 5.1 Database Schema

Three tables with focused indices:

```sql
-- Core search metadata
CREATE TABLE searches (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  query        TEXT NOT NULL,
  mode         TEXT DEFAULT 'normal',
  result_count INTEGER DEFAULT 0,
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_searches_query ON searches(query);
CREATE INDEX idx_searches_query_mode ON searches(query, mode);

-- Scraped business results (1:N relationship with searches)
CREATE TABLE results (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id             INTEGER NOT NULL,
  title                 TEXT,
  cid                   TEXT,
  stars                 REAL,
  reviews               INTEGER,
  category              TEXT,
  address               TEXT,
  complete_phone_number TEXT,
  url                   TEXT,
  FOREIGN KEY (search_id) REFERENCES searches(id)
);
CREATE INDEX idx_results_search ON results(search_id);

-- Resume states for cross-device pause/resume
CREATE TABLE resume_states (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  query           TEXT NOT NULL,
  mode            TEXT DEFAULT 'normal',
  resume_state    TEXT NOT NULL,    -- JSON blob
  partial_results TEXT,             -- JSON array blob
  result_count    INTEGER DEFAULT 0,
  device_id       TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_resume_device ON resume_states(device_id);
```

### 5.2 API Design

Authentication: Simple password-based (`?password=mergex-leadgen` or `Authorization: Bearer mergex-leadgen`).

**Key endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/searches` | POST | Batch insert search + results (transaction) |
| `/searches/match` | GET | Exact query+mode lookup (cache hit check) |
| `/searches/similar` | GET | Fuzzy LIKE search for related queries |
| `/searches/autocomplete` | GET | Prefix-based query suggestions |
| `/resume` | POST | Save pause state for cross-device resume |
| `/resume?device_id=...` | GET | Fetch resume states for specific device |

**Batch insert** uses D1's transaction support to atomically insert a search and all its results:

```typescript
// Pseudocode for POST /searches
const searchId = await db.prepare(
  'INSERT INTO searches (query, mode, result_count) VALUES (?, ?, ?)'
).bind(query, mode, results.length).run();

// Batch insert all results in one transaction
const stmt = db.prepare(
  'INSERT INTO results (search_id, title, cid, ...) VALUES (?, ?, ?, ...)'
);
await db.batch(results.map(r => stmt.bind(searchId, r.title, r.cid, ...)));
```

---

## Native Platform Integration

### 6.1 SaveToDownloadsPlugin (Custom Capacitor Plugin)

**File: `android/app/src/main/java/in/mergex/leadgen/SaveToDownloadsPlugin.java`**

A custom Capacitor plugin that bridges the web app to Android's MediaStore API:

```java
@CapacitorPlugin(name = "SaveToDownloads")
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        // 1. Receive Base64-encoded file data from JavaScript
        // 2. Decode to byte array
        // 3. Insert into MediaStore (Downloads collection)
        // 4. Write bytes via ContentResolver OutputStream
        // 5. Return file URI to JavaScript
    }
}
```

**Why MediaStore over direct file write:**
- Works on Android 10+ without WRITE_EXTERNAL_STORAGE permission
- Files appear in Downloads app immediately
- Survives app uninstall (files persist in Downloads)

### 6.2 Foreground Service Integration

```javascript
// Start before long-running scrape
await ForegroundService.startForegroundService({
  id: 77,
  title: 'Mergex LeadGen',
  body: 'Searching for places data...',
  smallIcon: 'ic_notification'
});

// Stop after scrape completes
await ForegroundService.stopForegroundService();
```

This prevents Android from killing the WebView during background scraping — critical for searches that take 30+ seconds.

---

## Data Pipeline: From HTML to Excel

The complete data flow through the system:

```
Google Search HTML
       │
       ▼
   DOMParser (native browser API)
       │
       ▼
   CSS Selector extraction (.VkpGBb containers)
       │
       ▼
   Per-field parsers (title, phone, address, etc.)
       │
       ▼
   libphonenumber-js validation & normalization
       │
       ▼
   CID enrichment (conditional, mode-dependent)
       │
       ▼
   Deduplication (Map-based, O(n))
       │
       ▼
   Structured result objects
       │
       ├──▶ Vue reactive state (UI display)
       ├──▶ localStorage cache (24h TTL, LRU)
       ├──▶ Cloudflare D1 (optional cloud sync)
       └──▶ write-excel-file → .xlsx → SaveToDownloads
```

### Excel Schema

```javascript
// 7 columns, professionally formatted
const schema = [
  { column: 'Name',           width: 30, value: r => r.title },
  { column: 'Category',       width: 20, value: r => r.category },
  { column: 'No. Of Reviews', width: 15, value: r => r.reviews, type: Number },
  { column: 'Stars',          width: 10, value: r => r.stars, type: Number },
  { column: 'Phone Number',   width: 20, value: r => r.completePhoneNumber },
  { column: 'Address',        width: 60, value: r => r.address },
  { column: 'Place Website',  width: 50, value: r => r.url }
];
```

---

## Resumability — Stateful Scraping Across Sessions

The resume system captures the scraper's exact state at the moment of pause:

### State Machine

```
IDLE ──▶ SEARCHING (Phase 1: Page scraping)
              │
              ├──▶ PAUSED (resumeState captured)
              │        │
              │        └──▶ RESUMED ──▶ SEARCHING (from saved offset)
              │
              ▼
         ENRICHING (Phase 2: CID lookups)
              │
              ├──▶ PAUSED (resumeState with enrichIndex)
              │        │
              │        └──▶ RESUMED ──▶ ENRICHING (from saved index)
              │
              ▼
         COMPLETED ──▶ Results displayed
```

### Resume State Persistence

```javascript
// Saved to both localStorage and cloud
const resumeState = {
  query: "restaurants in Chennai",
  mode: "normal",
  pagination: 30,           // Resume from page 4
  phase: "enrich",          // Was in enrichment phase
  enrichIndex: 15,          // 15 of 42 enriched
  partialResults: [...]     // 42 results collected so far
};

// Local
localStorage.setItem('mergex_resume_state', JSON.stringify(resumeState));

// Cloud (for cross-device resume)
api.saveResumeState({
  ...resumeState,
  deviceId: localStorage.getItem('mergex_device_id')
});
```

This enables:
1. **App restart resume** — user closes app, reopens, continues from exact point
2. **Background interruption resume** — OS kills app, user resumes
3. **Cross-device resume** — start on phone, continue on tablet

---

## Performance Characteristics & Benchmarks

### Request Count by Mode (per 100 results)

| Mode | Search Requests | Enrichment Requests | Total | Avg Time |
|------|----------------|-------------------|-------|----------|
| fast | 10 | 0 | 10 | ~5s |
| normal (phones found) | 10 | 0 | 10 | ~5s |
| normal (phones missing) | 10 | 100 | 110 | ~30s |
| long | 10 | 100 | 110 | ~45s |

### Memory Usage

| Operation | Memory |
|-----------|--------|
| HTML parsing (per page) | ~2-3 MB |
| Result storage (100 results) | ~50 KB |
| Cache (20 searches) | ~1 MB |
| Excel generation | ~5-10 MB (temporary) |

### Bundle Size Impact

| Dependency | Size (gzipped) |
|------------|----------------|
| libphonenumber-js | ~90 KB |
| write-excel-file | ~15 KB |
| Scraper (custom) | ~8 KB |
| API client (custom) | ~2 KB |
| DOMParser | 0 KB (browser built-in) |

---

## Conclusion

Mergex LeadGen's architecture is optimized for three things:

1. **Zero infrastructure cost** — Client-side scraping eliminates server compute. Cloudflare's free tier handles storage.
2. **Maximum reliability** — No single server to fail. Each user is their own scraping node with their own IP.
3. **Minimum complexity** — Native browser APIs (DOMParser, fetch) over external libraries. No headless browsers. No proxy servers. No API keys.

The scraper is not bolted onto the app — it IS the app. Every architectural decision (Capacitor for CORS bypass, foreground services for background execution, three search modes for flexibility, CID enrichment for data completeness, resume states for reliability) exists to make the scraper work better on a mobile device. The cloud layer is purely additive — the app works perfectly without it.

This is the leanest possible architecture for a mobile lead generation tool: maximum output, minimum infrastructure, zero ongoing costs.
