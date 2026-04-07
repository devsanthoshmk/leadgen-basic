# Mergex LeadGen API

Cloudflare Worker + D1 backend for storing and retrieving Google Local Listings search results.

---

## Setup

```bash
cd worker

# 1. Install dependencies
npm install

# 2. Create the D1 database
npx wrangler d1 create leadgen-db

# 3. Copy the returned database_id into wrangler.jsonc
#    Replace <PASTE_YOUR_D1_DATABASE_ID_HERE> with the actual id

# 4. Start local dev server (runs at http://localhost:8787)
npm run dev

# 5. Deploy to Cloudflare
npm run deploy
```

Tables are created automatically on the first request — no manual migration needed.

---

## Authentication

Every request must include one of:

| Method | Example |
|--------|---------|
| Query param | `?password=mergex-leadgen` |
| Auth header | `Authorization: Bearer mergex-leadgen` |

Unauthenticated requests return `401`.

---

## Endpoints

Base URL: `https://leadgen-api.<your-subdomain>.workers.dev`

---

### `POST /searches` — Save search results

Stores a search query and its array of business results.

**Request:**

```bash
curl -X POST "https://<base>/searches?password=mergex-leadgen" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "restaurants in Chennai",
    "mode": "fast",
    "results": [
      {
        "title": "Porchgrill Vandavasi",
        "cid": "17538011621469717377",
        "stars": 4,
        "reviews": 40232,
        "category": "Barbecue",
        "address": "GJ33+H6M, Vandavasi, Tamil Nadu 604408",
        "completePhoneNumber": "090807 16386",
        "url": ""
      }
    ]
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | The search term (e.g. "cafes in Mumbai") |
| `mode` | string | no | Search mode used: `fast`, `normal`, or `long`. Defaults to `normal` |
| `results` | array | yes | Array of business result objects (see schema below) |

**Result object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Business name |
| `cid` | string | Google's internal business ID |
| `stars` | number | Google rating (e.g. 4.5) |
| `reviews` | number | Total review count |
| `category` | string | Business type (e.g. "Restaurant") |
| `address` | string | Full address |
| `completePhoneNumber` | string | Phone number |
| `url` | string | Business website URL |

**Response** (`201`):

```json
{
  "id": 1,
  "resultsCount": 1
}
```

---

### `GET /searches` — List all searches

Returns all saved searches, most recent first. Supports pagination.

```bash
curl "https://<base>/searches?password=mergex-leadgen&limit=10&offset=0"
```

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `limit` | number | 20 | 100 | Results per page |
| `offset` | number | 0 | — | Skip this many rows |

**Response** (`200`):

```json
{
  "searches": [
    {
      "id": 1,
      "query": "restaurants in Chennai",
      "mode": "fast",
      "created_at": "2026-04-07 10:30:00"
    }
  ]
}
```

---

### `GET /searches/autocomplete?q=` — Autocomplete search terms

Returns distinct past search queries matching a prefix. Use this to power a search autocomplete dropdown.

```bash
curl "https://<base>/searches/autocomplete?password=mergex-leadgen&q=rest&limit=5"
```

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `q` | string | `""` | — | Prefix to match against past queries |
| `limit` | number | 10 | 50 | Max suggestions to return |

**Response** (`200`):

```json
{
  "suggestions": [
    "restaurants in Chennai",
    "restaurants in Mumbai"
  ]
}
```

---

### `GET /searches/:id` — Get search + results

Returns the search metadata and all its results in one call.

```bash
curl "https://<base>/searches/1?password=mergex-leadgen"
```

**Response** (`200`):

```json
{
  "search": {
    "id": 1,
    "query": "restaurants in Chennai",
    "mode": "fast",
    "created_at": "2026-04-07 10:30:00"
  },
  "results": [
    {
      "id": 1,
      "search_id": 1,
      "title": "Porchgrill Vandavasi",
      "cid": "17538011621469717377",
      "stars": 4,
      "reviews": 40232,
      "category": "Barbecue",
      "address": "GJ33+H6M, Vandavasi, Tamil Nadu 604408",
      "complete_phone_number": "090807 16386",
      "url": ""
    }
  ]
}
```

Returns `404` if the search id doesn't exist.

---

### `GET /searches/:id/results` — Get results only

Returns just the results array for a search (without the search metadata).

```bash
curl "https://<base>/searches/1/results?password=mergex-leadgen"
```

**Response** (`200`):

```json
{
  "searchId": 1,
  "results": [
    {
      "id": 1,
      "search_id": 1,
      "title": "Porchgrill Vandavasi",
      "cid": "17538011621469717377",
      "stars": 4,
      "reviews": 40232,
      "category": "Barbecue",
      "address": "GJ33+H6M, Vandavasi, Tamil Nadu 604408",
      "complete_phone_number": "090807 16386",
      "url": ""
    }
  ]
}
```

Returns `404` if no results exist for that search id.

---

## Database Schema

Two tables, auto-created on first request:

### `searches`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `query` | TEXT | The search term |
| `mode` | TEXT | `fast` / `normal` / `long` |
| `created_at` | TEXT | ISO timestamp, auto-set |

### `results`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `search_id` | INTEGER | Foreign key → `searches.id` |
| `title` | TEXT | Business name |
| `cid` | TEXT | Google business ID |
| `stars` | REAL | Rating |
| `reviews` | INTEGER | Review count |
| `category` | TEXT | Business type |
| `address` | TEXT | Full address |
| `complete_phone_number` | TEXT | Phone number |
| `url` | TEXT | Website URL |

Indexes: `idx_searches_query` on `searches(query)`, `idx_results_search` on `results(search_id)`.

---

## Error Responses

All errors return JSON:

```json
{ "error": "description of what went wrong" }
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (invalid JSON or missing required fields) |
| 401 | Missing or wrong password |
| 404 | Search id not found |

---

## CORS

All responses include permissive CORS headers. The worker handles `OPTIONS` preflight requests automatically, so you can call it directly from any browser app.

---

## Running Tests

```bash
cd worker
npm test
```

Tests use `@cloudflare/vitest-pool-workers` and run against a local D1 instance — no remote database needed.
