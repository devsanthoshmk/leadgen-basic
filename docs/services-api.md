# Services API Reference

## Scraper Service

**File:** `src/services/scraper.js`

### `search(query: string): Promise<Array>`

Main entry point. Scrapes Google Search for places matching the query.

**Parameters:**
- `query` — Search string (e.g., "restaurants in Chennai")

**Returns:** Array of result objects, deduplicated.

**Result Object Shape:**
```javascript
{
  title: "Restaurant Name",        // string — business name
  stars: 4.5,                       // number — rating (0 if not found)
  reviews: 128,                     // number — review count (0 if not found)
  category: "Indian Restaurant",    // string — business category
  address: "123 Main St, City",     // string — full address
  completePhoneNumber: "+91 98765 43210", // string — validated phone number
  url: "https://example.com"        // string — website URL
}
```

**Behavior:**
1. Constructs Google Search URL with `udm=1` parameter
2. Fetches HTML with browser-like headers (Chrome User-Agent)
3. Parses with `DOMParser` (browser-native, no jsdom dependency)
4. Extracts data using CSS selectors (`.VkpGBb` containers)
5. Validates phone numbers with `libphonenumber-js`
6. Paginates (increments by 10) until no results found
7. Returns deduplicated array

**Error Handling:** Returns empty array on fetch failure. Errors logged to console.

---

### Internal: `fetchit(url: string): Promise<Document>`

Fetches a URL and returns a parsed DOM Document.

**Headers Sent:**
```
User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/136.0.0.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8
Accept-Language: en-GB,en-US;q=0.9,en;q=0.8
```

**Timeout:** 20 seconds

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

### `shareLastFile(filename: string): Promise<void>`

Shares the last exported file using the native share dialog.

**Parameters:**
- `filename` — Display name for the share dialog

**Behavior:** Uses `@capacitor/share` to open the system share sheet. No-op if no file has been saved yet.

---

### `getLastSavedUri(): string | null`

Returns the file URI of the last saved Excel file, or `null` if none saved.
