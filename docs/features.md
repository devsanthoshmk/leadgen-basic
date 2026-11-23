# Features

## Search & Scraping

- **Google Places Search** — Enter any query like "hotels in Mumbai" or "pizza restaurants near downtown"
- **Three Search Modes:**
  - **Fast** — Quick scan, gets names, addresses, ratings, websites. Skips phone number lookups. Fastest.
  - **Auto (Default)** — Smart mode, fills in missing phone numbers only when needed. Best balance.
  - **Deep** — Fetches details for ALL results, better address accuracy. In development.
- **Automatic Pagination** — Fetches all available pages of results (10 per page)
- **Duplicate Removal** — Results are deduplicated by Google ID (CID) or title+address
- **Pause & Resume** — Pause a search mid-way, resume from where you left off
- **Data Extracted Per Result:**
  - Business/place name
  - CID (Google's unique business ID)
  - Star rating (0-5)
  - Number of reviews
  - Business category
  - Full address
  - Phone number (validated and normalized)
  - Website URL

## Results Display

### Results Toolbar
- **Results chip** — Shows total lead count + source indicator:
  - `(Cached)` — Loaded from local cache
  - `(paused)` — Partial results from paused search
- **Export button** — Download Excel file
- **Open button** — Open previously downloaded file
- **Share button** — Share file via system share sheet

### Card Layout
Each result displayed as a card showing:
- Name and category
- Star rating with icon and review count
- Address in gray text
- Clickable phone number and website chips

### Filter & Sort
- **Text Filter** — Search across name, category, address, and phone number (250ms debounce)
- **Sort by** — Name, Stars, Reviews, or Category
- **Sort Direction** — Toggle ascending/descending with a button

## Detail Modal

Tap any card to open a detail modal with:
- Full place information
- **Call** button — Opens phone dialer
- **Navigate** button — Opens Google Maps with the address
- **Website** button — Opens the place's website in browser

## Excel Export

- **Download Button** — Generates `.xlsx` file from all results
- **7-Column Spreadsheet:**
  | Column | Width |
  |--------|-------|
  | Name | 30 |
  | Category | 20 |
  | No. Of Reviews | 15 |
  | Stars | 10 |
  | Phone Number | 20 |
  | Address | 60 |
  | Place Website | 50 |
- **Android/iOS** — Saved to `Download/[query].xlsx`, notification sent
- **Web** — Standard browser file download
- **Share** — On native platforms, share the file via any installed app

## Search Mode Selector

In the search view, users can select between three modes:
- **Fast** — Lightning icon, quick scan
- **Auto** — Sync icon, automatically balances speed & data (recommended)
- **Deep** — Layers icon, more accurate (in development)

Each mode shows a description, speed/data bars, and feature checklist in a modal when tapped.

## History View

- **History list** — Shows past searches and saved paused states
- **Filter** — Search through history
- **Status dots:**
  - Green dot = completed
  - Amber dot = paused
- **Actions:**
  - Tap = load results
  - Play button = resume paused search
  - Trash button = delete

## Settings View

### Data Section
- **Clear Local Cache** — Remove cached searches

### Notifications Section
- **Push Notifications** — Enable/disable with button
- Shows permission status

### About Section
- App name and version (currently v2.0.0)

## Notifications

- **Search Complete** — Local notification when scraping finishes (useful when app is backgrounded)
- **Download Complete** — Local notification when Excel file is saved
- **Android Notification Channel** — "Search Updates" channel with high importance, vibration enabled

## Background Execution (Android)

- **Foreground Service** — Keeps the scraping process alive when the user switches to another app
- **Persistent Notification** — Shows "Searching for places data..." while scraping runs
- **Auto-Cleanup** — Service stops automatically when search completes

## UI Features

- **Three-View Layout** — Search → Results → (History/Settings via tabs)
- **Tab Navigation** — Search, History, Settings tabs in footer
- **Shake Animation** — Search container shakes when submitting an empty query
- **Loading Spinner** — Shown during search with disabled button
- **Pause Button** — Shows during active search to pause mid-way
- **Toast Notifications** — "Searching in background..." and download confirmations
- **Social Links** — GitHub, LinkedIn, Instagram links in footer (via info modal)
- **Custom App Icon** — Location pin with magnifying glass + data bars on blue background
- **Dark Mode Support** — Respects system dark mode preference

## Search Tags

Quick search suggestions in the search view:
- "Restaurants in Bangalore"
- "Cafes in Mumbai"
- "Gyms in Hyderabad"

Tap any tag to instantly search that query.

## App Info Modal

Accessible via info button (i) in header:
- About Mergex
- Company divisions
- Contact info (website, email, phone, WhatsApp)
- Social links (LinkedIn, Twitter, Instagram)
- Built On (credits to places-data-app open source)
- Developer info