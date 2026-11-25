# How Mergex LeadGen Works — A Plain English Guide

> Everything about how this app works, explained without the jargon.

---

## What Is Mergex LeadGen?

Mergex LeadGen is a mobile app that helps you find business information — names, phone numbers, addresses, ratings, websites — for any type of business in any location. You type in something like "dentists in Mumbai" and it gives you a spreadsheet full of leads you can use for sales, marketing, or research.

Think of it as a smart assistant that does the tedious work of manually searching Google, clicking on each business, copying their phone number, and pasting it into a spreadsheet — except it does this for hundreds of businesses in seconds.

We can integrate other features later like AI based lead scoring, other sources like linkedin, X, reddit and more.

---

## The Big Picture

Here's what happens when you search for something:

```
You type "restaurants in Chennai"
        |
        v
The app goes to Google and reads the results
        |
        v
It picks out the business details from each result
        |
        v
It finds missing phone numbers by digging deeper (if needed full complete address too)
        |
        v
It removes duplicates and cleans up the data
        |
        v
You see a list of businesses with all their info
        |
        v
You export it all to an Excel file with one tap
```

That's it at a high level. Now let's break each piece down.

---

## Part 1: The Search

### What actually happens when you hit "Generate"

When you type a query and hit the generate button, the app doesn't use any paid API or special service. It literally does what you would do manually — it goes to Google Search and reads the page but not with the browser or other heavy work just by reverse engineering the google search results page internal APIs.

But instead of showing you the Google webpage, the app reads the raw code behind that webpage (the HTML) and pulls out just the business information.

**How does it read Google without opening a browser?**

The app sends a request to Google the same way your browser does — it just doesn't render the visual page. It's like asking Google the question and reading the answer from behind the scenes, instead of looking at the pretty webpage.

**On mobile, this is even more clever.** Mobile apps can make web requests without the usual browser restrictions. When you visit a website in Chrome, the browser enforces rules about which sites can talk to each other (called CORS). But our app uses the phone's own networking capability to talk directly to Google — no browser restrictions apply. This is the same technology that every app on your phone uses to fetch data. Moreover this approch uses your residential IP address to make requests to google and also mimics the way a real user interacts with google so it is less likely to be blocked by google.

### The three search modes

You get to choose how thorough the search is:

**Fast Mode** — Gets you results in about 5 seconds per 200-300 businesses. You'll get names, addresses, categories, ratings, and websites. Phone numbers may be missing since it skips the detail lookup step. Best when you need a quick list and don't need to call everyone.

**Auto Mode (Default)** — The smart middle ground. It first checks if Google already showed phone numbers in the search results. If yes, it's done fast — just like fast mode. If not, it goes and fetches the phone numbers one by one using each business's unique Google ID. Takes about 10-20 seconds for 200-300 businesses.

**Deep Mode (In Development)** — Goes the extra mile for every single business. Even if Google showed a phone number, it double-checks by looking up each business individually to get more details (now it gets full complete address). Most thorough, but slowest. Takes about 20-30 seconds for 200-300 businesses. This is in development — more features coming soon.

---

## Part 2: The Scraping — How Data Is Extracted

### Reading the Google page

When Google shows you local business results (the kind with ratings, addresses, and map pins), each business listing is wrapped in a specific structure in the page code. Our app knows exactly where to look in that structure.

It's like knowing that in a phonebook, the name is always bold, the number is always on the right, and the address is always in italics. Once you know the layout, you can extract info from thousands of entries without reading the whole page.

**For each business, the app extracts:**

| What | How |
|------|-----|
| Business name | From the heading of each listing (role="heading") |
| Star rating | From the rating display (e.g., 4.5 out of 5) |
| Number of reviews | From the review count (e.g., "128 reviews") |
| Business category | From the type label (e.g., "Indian Restaurant") |
| Address | From the directions link embedded in the listing (/maps/dir/) |
| Phone number | From the listing text, then validated for correctness |
| Website | From the website link in the listing |
| CID (Google ID) | From the data-cid attribute for detailed lookups |

### Getting more results (pagination)

Google shows 10 results per page. If there are 200 restaurants in Chennai, that's 20 pages of results. The app automatically moves through all 20 pages, collecting every result.

It keeps going until Google says "no more results" — then it stops. You don't have to click "next page" 20 times. The app does it all in one go.

### The phone number problem (and how we solve it)

Phone numbers are the trickiest part. Google doesn't always show them on the search results page. Sometimes you have to click into a business's details to find the number.

Here's what the app does:

1. **First, it checks the search page** — if the phone number is right there, great, grab it.
2. **If it's missing, it asks Google for more details** — Google has a special way to request extra info about a business using its unique ID (think of it like a social security number for businesses on Google). The app uses this to fetch the phone number.
3. **It validates every number** — Using the same phone number library that Google uses, the app checks that each number is real and formats it properly (e.g., "+91 98765 43210" instead of "9876543210").

### Removing duplicates

When you search across 20 pages of results, Google sometimes shows the same business twice. The app catches this by checking each business's unique Google ID. If two results have the same ID, it keeps only one.

---

## Part 3: The Export — From Screen to Spreadsheet

Once you have your results, one tap creates a professional Excel file.

**The spreadsheet has 7 columns:**
1. Name
2. Category
3. Number of Reviews
4. Stars
5. Phone Number
6. Address
7. Place Website

**On your phone**, the file saves directly to your Downloads folder. You get a notification when it's ready. You can also share it directly to WhatsApp, email, or any other app.

**On the web version**, it downloads through your browser like any other file.

---

## Part 4: Pause and Resume — Never Lose Progress

### The problem it solves

Imagine you're searching for "hotels in all of India" — that could take several minutes and return thousands of results. What if you get a phone call? What if your battery dies? What if you need to close the app?

### How pause works

When you tap the pause button, the app freezes the search at the exact point it's at. It remembers:

- Which page of Google results it was on (e.g., page 15 of 30)
- How many results it has collected so far
- Which results still need phone number lookups
- Exactly where it stopped in the phone number lookup process

All of this is saved locally on your phone.

### How resume works

When you go to your history, you'll see paused searches marked with an amber dot. Tap the play button to resume and the search picks up from the exact point it stopped — it doesn't start over.

### Technical details about resume

The `search()` function in `scraper.js` accepts a 4th argument `resumeState`. When provided:
- Phase 1 (search pages): starts from `resumeState.pagination` offset instead of page 0, and seeds results with `resumeState.partialResults`.
- Phase 2 (enrich): if paused mid-enrichment, resumes from `resumeState.enrichIndex` so already-enriched items aren't re-fetched.
- If `resumeState.phase === 'enrich'`, Phase 1 is skipped entirely.

---

## Part 5: Running in the Background

### The problem

When you switch away from an app on your phone (to answer a call, check a message, etc.), Android and iOS try to save battery by pausing or killing apps that are in the background.

For a search that takes 30+ seconds, this is a problem. If the OS kills the app mid-search, you lose your progress.

### The solution

On Android, the app starts a "foreground service" — this is the same technology that music players use to keep playing when you switch apps. You'll see a notification saying "Mergex LeadGen — Searching for places data..." while the search is running.

This tells Android: "Hey, this app is actively doing something important, don't kill it." The search continues even if you switch to another app.

When the search finishes, the foreground service stops, and you get a notification with your results.

---

## Part 6: The History System

### What's in history

Every search you complete is saved to your local history. Each entry shows:
- The search query
- How many results were found
- When you searched
- The search mode used (Fast, Auto, or Deep)

### Completed vs. Paused

- **Green dot** = Completed search. All results are available. You can view, export, or delete.
- **Amber dot** = Paused search. Has partial results. You can resume or delete.

### History actions

- **Tap** — Load the results (or resume a paused search)
- **Play button** — Resume a paused search
- **Trash button** — Delete the history item

---

## Part 7: Results View Features

### Filtering and sorting

Once you have results, you can:

- **Text filter** — Type to filter results instantly (searches across name, category, address, and phone) with 250ms debounce
- **Sort by** — Name, Stars, Reviews, or Category
- **Sort direction** — Toggle ascending/descending

### Results source indicator

The toolbar chip shows where results came from:
- **(Cached)** — Loaded from local cache (24-hour cache)
- **(paused)** — Search was paused, showing partial results

### Business actions

Tap on any business card to see its full details. From there you can:

- **Call** — Tap the phone number to open your dialer
- **Navigate** — Tap the address to open Google Maps with directions
- **Visit website** — Tap to open the business website in your browser

---

## Part 8: Settings

### Data

- **Clear Local Cache** — Remove all cached searches from the device

### Notifications

- **Enable/Disable** — Request notification permissions
- **Status** — Shows if notifications are granted

### About

- Shows app version (currently v2.0.0)

---

## Part 9: How Everything Connects

Here's the complete picture of how all the pieces fit together:

```
┌─────────────────────────────────────────────┐
│              YOUR PHONE                      │
│                                              │
│   You type a search query                    │
│          |                                   │
│          v                                   │
│   App checks: Is it cached locally? ─── Yes ─── Show cached results
│          |                                   │
│          No                                  │
│          |                                   │
│          v                                   │
│   Scraper fetches Google Search pages        │
│   (10 results per page, keeps going)         │
│          |                                   │
│          v                                   │
│   Extracts business data from HTML           │
│   (name, address, rating, category, etc.)    │
│          |                                   │
│          v                                   │
│   Fetches missing phone numbers              │
│   (using Google's business ID lookup)        │
│          |                                   │
│          v                                   │
│   Removes duplicates                         │
│          |                                   │
│          v                                   │
│   Shows you the results                      │
│          |                                   │
│    ┌─────┴─────────────────────┐             │
│    v                           v             │
│  Export to                Cache locally      │
│  Excel                    (24 hours)         │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Part 10: What Makes This Different

### No paid APIs

Most lead generation tools charge per search or per lead because they use paid services like Google Places API ($17 per 1000 lookups). Mergex reads the same information from Google Search for free.

### No servers doing the heavy lifting

Your phone does all the work. There's no expensive server farm running scrapers. This means:
- The app costs nothing to run at scale
- There's no server that can go down and break everything
- Your searches are private — they happen on your device

### Works offline (mostly)

The scraping needs an internet connection (it has to reach Google), but viewing cached results, browsing history, and exporting to Excel all work offline.

### Smart about efficiency

The Auto search mode doesn't waste time fetching phone numbers that are already available. It checks first, then only does extra work when needed. This makes it 3-4x faster than a "fetch everything always" approach.

### Pause and resume

No other comparable tool lets you pause a search mid-way and continue later right where you left off. This is critical for large searches that might take minutes.

---

## Technical Summary (For the Curious)

| Component | Technology | Why This Choice |
|-----------|-----------|----------------|
| App framework | Vue 3 + Ionic 8 | One codebase for Android, iOS, and web |
| Native bridge | Capacitor 8 | Lets the web app use phone features (files, notifications, HTTP) |
| Scraping | fetch + DOMParser | Built-in browser tools, zero extra libraries, fastest possible |
| Phone validation | libphonenumber-js | Same library Google uses internally |
| Excel export | write-excel-file | Tiny library, generates real .xlsx files |
| Background mode | Android Foreground Service | Keeps search alive when app is minimized |
| File saving | Custom Android plugin | Saves directly to Downloads folder |

---

## Frequently Asked Questions

**Does this break any Google rules?**
The app accesses publicly available Google Search results — the same information anyone can see by visiting google.com. It doesn't bypass any login walls or access private data.

**Why does it need internet access?**
To reach Google Search. Everything else (parsing, filtering, exporting) happens on your phone.

**Can it search for businesses in other countries?**
Yes. The search query determines the location. "plumbers in London" works just as well as "plumbers in Chennai."

**Why are some phone numbers missing?**
Not all businesses have phone numbers listed on Google. The app can only find what Google has. The "Deep" search mode finds the most phone numbers by checking multiple sources for each business.

**How many results can it find?**
As many as Google has. For a major city and popular business type, this could be 200-500+ results. For niche queries in small towns, it might be 10-20.

**Does it cost money to use?**
The app itself is free. You need an internet connection to scrape, but the scraping doesn't cost anything — it's just loading web pages.

**What happens if I lose internet mid-search?**
If you have pause/resume enabled, your progress is saved. Reconnect and resume from where you left off. If you didn't pause, you'll need to start over, but the cache might have partial results.

**What's the difference between the three modes?**
- **Fast**: Gets what's on the search page immediately, skips extra lookups
- **Auto**: Checks if phones are already there, fetches missing ones only if needed (recommended)
- **Deep**: Fetches extra details for ALL results, more accurate addresses, more phone coverage (in development)
