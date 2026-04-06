/**
 * Mergex LeadGen API Worker
 *
 * Stores Google Local Listings search results in Cloudflare D1.
 * Provides endpoints to:
 *   - Save search results        POST   /searches
 *   - Autocomplete search terms   GET   /searches/autocomplete?q=...
 *   - Get results by search ID    GET   /searches/:id/results
 *   - Get both (term + results)   GET   /searches/:id
 *   - List all searches           GET   /searches
 *
 * Auth: pass `?password=mergex-leadgen` or header `Authorization: Bearer mergex-leadgen`
 */

interface Env {
	DB: D1Database;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const API_PASSWORD = "mergex-leadgen";

function isAuthorized(request: Request): boolean {
	const url = new URL(request.url);
	const qp = url.searchParams.get("password");
	if (qp === API_PASSWORD) return true;

	const auth = request.headers.get("Authorization") ?? "";
	if (auth === `Bearer ${API_PASSWORD}`) return true;

	return false;
}

function unauthorized(): Response {
	return Response.json({ error: "Unauthorized. Pass ?password=mergex-leadgen or Authorization: Bearer mergex-leadgen" }, { status: 401 });
}

// ─── CORS ────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
	};
}

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json", ...corsHeaders() },
	});
}

// ─── DB Schema bootstrap ─────────────────────────────────────────────────────

async function ensureTables(db: D1Database) {
	await db.batch([
		db.prepare(`
			CREATE TABLE IF NOT EXISTS searches (
				id         INTEGER PRIMARY KEY AUTOINCREMENT,
				query      TEXT    NOT NULL,
				mode       TEXT    DEFAULT 'normal',
				created_at TEXT    DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`
			CREATE TABLE IF NOT EXISTS results (
				id                   INTEGER PRIMARY KEY AUTOINCREMENT,
				search_id            INTEGER NOT NULL,
				title                TEXT,
				cid                  TEXT,
				stars                REAL,
				reviews              INTEGER,
				category             TEXT,
				address              TEXT,
				complete_phone_number TEXT,
				url                  TEXT,
				FOREIGN KEY (search_id) REFERENCES searches(id)
			)
		`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_results_search ON results(search_id)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query)`),
	]);
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * POST /searches
 * Body: { query: string, mode?: string, results: Result[] }
 * Saves a search and its results. Returns the search id.
 */
async function handleSaveSearch(request: Request, db: D1Database): Promise<Response> {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, 400);
	}

	const { query, mode, results } = body;
	if (!query || !Array.isArray(results)) {
		return json({ error: "Body must have `query` (string) and `results` (array)" }, 400);
	}

	// Insert search row
	const searchResult = await db
		.prepare("INSERT INTO searches (query, mode) VALUES (?, ?) RETURNING id")
		.bind(query, mode ?? "normal")
		.first<{ id: number }>();

	const searchId = searchResult!.id;

	// Batch-insert results (D1 batch limit is 100 statements, chunk if needed)
	const stmts = results.map((r: any) =>
		db
			.prepare(
				`INSERT INTO results (search_id, title, cid, stars, reviews, category, address, complete_phone_number, url)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				searchId,
				r.title ?? null,
				r.cid ?? null,
				r.stars ?? null,
				r.reviews ?? null,
				r.category ?? null,
				r.address ?? null,
				r.completePhoneNumber ?? r.complete_phone_number ?? null,
				r.url ?? null
			)
	);

	// D1 batch can handle up to 100 statements; chunk for safety
	for (let i = 0; i < stmts.length; i += 90) {
		await db.batch(stmts.slice(i, i + 90));
	}

	return json({ id: searchId, resultsCount: results.length }, 201);
}

/**
 * GET /searches/autocomplete?q=...
 * Returns distinct search terms matching the prefix (for autocomplete).
 */
async function handleAutocomplete(url: URL, db: D1Database): Promise<Response> {
	const q = url.searchParams.get("q") ?? "";
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);

	const rows = await db
		.prepare(
			`SELECT DISTINCT query FROM searches
			 WHERE query LIKE ?
			 ORDER BY created_at DESC
			 LIMIT ?`
		)
		.bind(`${q}%`, limit)
		.all<{ query: string }>();

	return json({ suggestions: rows.results.map((r) => r.query) });
}

/**
 * GET /searches/:id/results
 * Returns results array for a given search id.
 */
async function handleGetResults(searchId: number, db: D1Database): Promise<Response> {
	const results = await db
		.prepare("SELECT * FROM results WHERE search_id = ? ORDER BY id")
		.bind(searchId)
		.all();

	if (results.results.length === 0) {
		return json({ error: "No results found for this search id" }, 404);
	}
	return json({ searchId, results: results.results });
}

/**
 * GET /searches/:id
 * Returns the search metadata AND its results.
 */
async function handleGetSearch(searchId: number, db: D1Database): Promise<Response> {
	const search = await db
		.prepare("SELECT * FROM searches WHERE id = ?")
		.bind(searchId)
		.first();

	if (!search) {
		return json({ error: "Search not found" }, 404);
	}

	const results = await db
		.prepare("SELECT * FROM results WHERE search_id = ? ORDER BY id")
		.bind(searchId)
		.all();

	return json({ search, results: results.results });
}

/**
 * GET /searches
 * Lists all searches (most recent first). Pagination via ?limit=&offset=.
 */
async function handleListSearches(url: URL, db: D1Database): Promise<Response> {
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 100);
	const offset = Number(url.searchParams.get("offset") ?? 0);

	const rows = await db
		.prepare("SELECT * FROM searches ORDER BY created_at DESC LIMIT ? OFFSET ?")
		.bind(limit, offset)
		.all();

	return json({ searches: rows.results });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		// Auth check
		if (!isAuthorized(request)) {
			return unauthorized();
		}

		// Bootstrap tables on first request (idempotent)
		await ensureTables(env.DB);

		const url = new URL(request.url);
		const path = url.pathname;

		// POST /searches — save search + results
		if (request.method === "POST" && path === "/searches") {
			return handleSaveSearch(request, env.DB);
		}

		// GET /searches/autocomplete?q=...
		if (request.method === "GET" && path === "/searches/autocomplete") {
			return handleAutocomplete(url, env.DB);
		}

		// GET /searches/:id/results
		const resultsMatch = path.match(/^\/searches\/(\d+)\/results$/);
		if (request.method === "GET" && resultsMatch) {
			return handleGetResults(Number(resultsMatch[1]), env.DB);
		}

		// GET /searches/:id
		const searchMatch = path.match(/^\/searches\/(\d+)$/);
		if (request.method === "GET" && searchMatch) {
			return handleGetSearch(Number(searchMatch[1]), env.DB);
		}

		// GET /searches — list all
		if (request.method === "GET" && path === "/searches") {
			return handleListSearches(url, env.DB);
		}

		// Fallback
		return json({
			message: "Mergex LeadGen API",
			endpoints: {
				"POST /searches": "Save search results (body: {query, mode?, results[]})",
				"GET /searches": "List all searches",
				"GET /searches/autocomplete?q=": "Autocomplete search terms",
				"GET /searches/:id": "Get search + results by id",
				"GET /searches/:id/results": "Get only results by search id",
			},
		});
	},
} satisfies ExportedHandler<Env>;
