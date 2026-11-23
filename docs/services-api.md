# Services API Reference

## Scraper Service

**File:** `src/services/scraper.js`

### `search(query: string, mode?: string, onProgress?: function, resumeState?: object): Promise<{results: Array, resumeState: object|null}>`

Main entry point. Scrapes Google Search for places matching the query.

**Parameters:**
- `query` — Search string (e.g., "restaurants in Chennai")
- `mode` — Search mode: "fast" | "normal" | "long" (default: "normal")
- `onProgress` — Progress callback function, return `false` to pause
- `resumeState` — State object from a previous paused search

**Returns:** `{ results: Array, resumeState: object|null }`

- `resumeState` is non-null if search was paused

**Progress Callback:**
Called with `{ phase, page, found, message }` during search phase, or `{ phase, current, total, message }` during enrich phase.

Return `false` from callback to pause the search.

**Resume State Object:**
```javascript
{
  query: string,       // Original search query
  mode: string,       // Search mode that was active
  pagination: number, // Google pagination offset
  phase: 'search' | 'enrich', // Which phase was interrupted
  enrichIndex: number, // Index of next item to enrich
  partialResults: Array, // Results collected so far
}
```

**Result Object Shape:**
```javascript
{
  title: "Restaurant Name",      // string — business name
  cid: "ABC123...",                // string — Google business ID
  stars: 4.5,                    // number — rating (0 if not found)
  reviews: 128,                   // number — review count (0 if not found)
  category: "Indian Restaurant",   // string — business category
  address: "123 Main St, City",  // string — full address
  completePhoneNumber: "+91 98765 43210", // string — validated phone number
  url: "https://example.com"      // string — website URL
}
```

**Behavior:**
1. Checks local cache (24h TTL), returns if found
2. Constructs Google Search URL with `udm=1` parameter
3. Fetches HTML with browser-like headers (Chrome User-Agent)
4. Parses with `DOMParser` (browser-native, no jsdom dependency)
5. Extracts data using CSS selectors (`.VkpGBb` containers, `data-cid`)
6. Deduplicates by CID or title+address
7. Phase 2: For non-fast modes, fetches missing phone numbers via CID lookup
8. Returns results + resumeState (if paused)

---

### `fetchit(url: string): Promise<Array>`

Fetches a Google Search URL and returns parsed results.

**Returns:** Array of result objects (same shape as above).

---

### `fetchExtraDetails(query: string, cid: string): Promise<string|null>`

Fetches extra details for a specific business using Google's async endpoint.

**Parameters:**
- `query` — Original search query
- `cid` — Business's Google ID

**Returns:** Raw response text or `null` on error.

---

### `extractContactInfoBulletproof(rawPayload: string): Promise<Object>`

Parses contact info from Google's raw response payload.

**Returns:**
```javascript
{
  address: string|null,
  phoneNumbers: string[]
}
```

---

### Internal: `parseHTML(html: string): Document`

Parses HTML string to DOM Document. Uses native `DOMParser` in browser, `jsdom` in Node.js.

---

### Internal: `extractPhone(text: string): string`

Extracts phone number (8+ digits) from text string.

---

### Internal: `dedup(list: Array): Array`

Deduplicates results by CID or title+address composite key.

---

## Excel Service

**File:** `src/services/excel.js`

### `makeExcel(data: Array, query: string): Promise<{uri?, filename}>`

Generates an Excel file from result data.

**Parameters:**
- `data` — Array of result objects from `search()`
- `query` — Search query string (used for filename)

**Returns:**
- Native: `{ uri: "file:///...", filename: "query.xlsx" }`
- Web: `{ filename: "query.xlsx" }`

**Behavior:**
- Generates filename: `[sanitized_query].xlsx` (non-alphanumeric chars replaced with `_`)
- Creates `.xlsx` using `write-excel-file/browser`
- **Native:** Converts blob to base64, saves to `Download/` via Capacitor Filesystem, sends "Download Complete" notification
- **Web:** Creates blob URL, triggers download via hidden `<a>` element

**Throws:** `Error('No data to export')` if data is empty/null.

---

### `saveToDownloads(data: Array, query: string): Promise<{uri: string, filename: string}>`

Saves Excel file to Downloads folder (native only).

**Parameters:**
- `data` — Array of result objects
- `query` — Search query for filename

**Returns:** `{ uri: string, filename: string }`

---

### `shareLastFile(filename: string): Promise<void>`

Shares the last exported file using the native share dialog.

**Parameters:**
- `filename` — Display name for the share dialog

**Behavior:** Uses `@capacitor/share` to open the system share sheet. No-op if no file has been saved yet.

---

### `getLastSavedUri(): string|null`

Returns the file URI of the last saved Excel file, or `null` if none saved.

---

## Example Usage

```javascript
import { search } from './services/scraper.js';
import { makeExcel } from './services/excel.js';

// Simple search
const { results } = await search('restaurants in Chennai');

// With progress callback
const { results, resumeState } = await search('cafes in Mumbai', 'normal', (progress) => {
  console.log(progress.message);
  return true; // keep going
});

// Pause mid-search
search('hotels in Bangalore', 'normal', () => {
  // Return false to pause
  return this.shouldPause ? false : true;
}).then(({ results, resumeState }) => {
  if (resumeState) {
    console.log('Search paused, can resume later');
    // Save resumeState for later...
  }
});

// Export to Excel
const { uri, filename } = await makeExcel(results, 'restaurants in Chennai');
```