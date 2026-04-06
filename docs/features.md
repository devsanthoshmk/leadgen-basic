# Features

## Search & Scraping

- **Google Places Search** — Enter any query like "hotels in Mumbai" or "pizza restaurants near downtown"
- **Automatic Pagination** — Fetches all available pages of results (10 per page)
- **Duplicate Removal** — Results are deduplicated before display
- **Data Extracted Per Result:**
  - Business/place name
  - Star rating (0-5)
  - Number of reviews
  - Business category
  - Full address
  - Phone number (validated and normalized)
  - Website URL

## Results Display

- **Card Layout** — Each result displayed as a card showing:
  - Name, category, star rating with icon, review count
  - Address in gray text
  - Clickable phone number and website chips
- **Text Filter** — Search across name, category, address, and phone number (250ms debounce)
- **Sorting** — Sort by Name, Stars, Reviews, or Category
- **Sort Direction** — Toggle ascending/descending with a button
- **Result Count** — Chip showing total number of results

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

## Notifications

- **Search Complete** — Local notification when scraping finishes (useful when app is backgrounded)
- **Download Complete** — Local notification when Excel file is saved
- **Android Notification Channel** — "Search Updates" channel with high importance, vibration enabled

## Background Execution (Android)

- **Foreground Service** — Keeps the scraping process alive when the user switches to another app
- **Persistent Notification** — Shows "Searching for places data..." while scraping runs
- **Auto-Cleanup** — Service stops automatically when search completes

## UI Features

- **Two-View Layout** — Clean search view → results view transition
- **Shake Animation** — Search container shakes when submitting an empty query
- **Loading Spinner** — Shown during search with disabled button
- **Toast Notifications** — "Searching in background..." and download confirmations
- **Social Links** — GitHub, LinkedIn, Instagram links in footer
- **Custom App Icon** — Location pin with magnifying glass + data bars on blue background
- **Dark Mode Support** — Respects system dark mode preference
