/**
 * Mergex LeadGen API Worker
 *
 * Stores Google Local Listings search results in Cloudflare D1.
 * Provides endpoints for search storage, cloud sync matching,
 * cross-device resumability, and history management.
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
	return Response.json(
		{ error: "Unauthorized. Pass ?password=mergex-leadgen or Authorization: Bearer mergex-leadgen" },
		{ status: 401 }
	);
}

// ─── CORS ────────────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
				result_count INTEGER DEFAULT 0,
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
		db.prepare(`
			CREATE TABLE IF NOT EXISTS resume_states (
				id              INTEGER PRIMARY KEY AUTOINCREMENT,
				query           TEXT    NOT NULL,
				mode            TEXT    DEFAULT 'normal',
				resume_state    TEXT    NOT NULL,
				partial_results TEXT,
				result_count    INTEGER DEFAULT 0,
				device_id       TEXT,
				created_at      TEXT    DEFAULT (datetime('now')),
				updated_at      TEXT    DEFAULT (datetime('now'))
			)
		`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_results_search ON results(search_id)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_searches_query ON searches(query)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_searches_query_mode ON searches(query, mode)`),
		db.prepare(`CREATE INDEX IF NOT EXISTS idx_resume_device ON resume_states(device_id)`),
	]);
}

// ─── Route handlers ──────────────────────────────────────────────────────────

/**
 * POST /searches
 * Body: { query: string, mode?: string, results: Result[] }
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

	const searchResult = await db
		.prepare("INSERT INTO searches (query, mode, result_count) VALUES (?, ?, ?) RETURNING id")
		.bind(query, mode ?? "normal", results.length)
		.first<{ id: number }>();

	const searchId = searchResult!.id;

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

	for (let i = 0; i < stmts.length; i += 90) {
		await db.batch(stmts.slice(i, i + 90));
	}

	return json({ id: searchId, resultsCount: results.length }, 201);
}

/**
 * GET /searches/match?q=...&mode=...
 * Exact match lookup: returns the most recent search with identical query+mode and its results.
 */
async function handleMatchSearch(url: URL, db: D1Database): Promise<Response> {
	const q = url.searchParams.get("q") ?? "";
	const mode = url.searchParams.get("mode") ?? "normal";

	if (!q) return json({ error: "Query parameter `q` is required" }, 400);

	const search = await db
		.prepare("SELECT * FROM searches WHERE LOWER(query) = LOWER(?) AND mode = ? ORDER BY created_at DESC LIMIT 1")
		.bind(q, mode)
		.first();

	if (!search) {
		return json({ match: null });
	}

	const results = await db
		.prepare("SELECT * FROM results WHERE search_id = ? ORDER BY id")
		.bind(search.id)
		.all();

	return json({ match: { search, results: results.results } });
}

/**
 * GET /searches/similar?q=...&limit=5
 * Fuzzy match: returns searches whose query contains the search term.
 */
async function handleSimilarSearches(url: URL, db: D1Database): Promise<Response> {
	const q = url.searchParams.get("q") ?? "";
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 5), 20);

	if (!q) return json({ error: "Query parameter `q` is required" }, 400);

	// Split query into words and match any that contain the key terms
	const words = q.trim().toLowerCase().split(/\s+/).filter(w => w.length > 2);
	if (words.length === 0) return json({ similar: [] });

	// Use LIKE with the full query first, then individual significant words
	const rows = await db
		.prepare(
			`SELECT id, query, mode, result_count, created_at FROM searches
			 WHERE LOWER(query) LIKE ? AND LOWER(query) != LOWER(?)
			 ORDER BY created_at DESC
			 LIMIT ?`
		)
		.bind(`%${q}%`, q, limit)
		.all();

	// If not enough results, try matching individual words
	let similar = rows.results;
	if (similar.length < limit && words.length > 0) {
		const mainWord = words.reduce((a, b) => a.length > b.length ? a : b);
		const moreRows = await db
			.prepare(
				`SELECT id, query, mode, result_count, created_at FROM searches
				 WHERE LOWER(query) LIKE ? AND LOWER(query) != LOWER(?) AND LOWER(query) NOT LIKE ?
				 ORDER BY created_at DESC
				 LIMIT ?`
			)
			.bind(`%${mainWord}%`, q, `%${q}%`, limit - similar.length)
			.all();
		similar = [...similar, ...moreRows.results];
	}

	return json({ similar });
}

/**
 * GET /searches/autocomplete?q=...
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
 */
async function handleListSearches(url: URL, db: D1Database): Promise<Response> {
	const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
	const offset = Number(url.searchParams.get("offset") ?? 0);

	const rows = await db
		.prepare("SELECT * FROM searches ORDER BY created_at DESC LIMIT ? OFFSET ?")
		.bind(limit, offset)
		.all();

	return json({ searches: rows.results });
}

/**
 * DELETE /searches/:id
 */
async function handleDeleteSearch(searchId: number, db: D1Database): Promise<Response> {
	const search = await db.prepare("SELECT id FROM searches WHERE id = ?").bind(searchId).first();
	if (!search) return json({ error: "Search not found" }, 404);

	await db.batch([
		db.prepare("DELETE FROM results WHERE search_id = ?").bind(searchId),
		db.prepare("DELETE FROM searches WHERE id = ?").bind(searchId),
	]);

	return json({ deleted: true, id: searchId });
}

/**
 * POST /resume
 * Body: { query, mode, resumeState, partialResults, resultCount, deviceId }
 */
async function handleSaveResume(request: Request, db: D1Database): Promise<Response> {
	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON body" }, 400);
	}

	const { query, mode, resumeState, partialResults, resultCount, deviceId } = body;
	if (!query || !resumeState) {
		return json({ error: "Body must have `query` and `resumeState`" }, 400);
	}

	// Upsert: delete existing resume for same query+device, then insert
	if (deviceId) {
		await db
			.prepare("DELETE FROM resume_states WHERE query = ? AND device_id = ?")
			.bind(query, deviceId)
			.run();
	}

	const row = await db
		.prepare(
			`INSERT INTO resume_states (query, mode, resume_state, partial_results, result_count, device_id)
			 VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
		)
		.bind(
			query,
			mode ?? "normal",
			typeof resumeState === "string" ? resumeState : JSON.stringify(resumeState),
			partialResults ? (typeof partialResults === "string" ? partialResults : JSON.stringify(partialResults)) : null,
			resultCount ?? 0,
			deviceId ?? null
		)
		.first<{ id: number }>();

	return json({ id: row!.id }, 201);
}

/**
 * GET /resume
 * Returns all pending resume states (optionally filtered by device_id).
 */
async function handleGetResume(url: URL, db: D1Database): Promise<Response> {
	const deviceId = url.searchParams.get("device_id");

	let rows;
	if (deviceId) {
		rows = await db
			.prepare("SELECT * FROM resume_states WHERE device_id = ? ORDER BY updated_at DESC")
			.bind(deviceId)
			.all();
	} else {
		rows = await db
			.prepare("SELECT * FROM resume_states ORDER BY updated_at DESC LIMIT 20")
			.all();
	}

	return json({ resumeStates: rows.results });
}

/**
 * DELETE /resume/:id
 */
async function handleDeleteResume(resumeId: number, db: D1Database): Promise<Response> {
	await db.prepare("DELETE FROM resume_states WHERE id = ?").bind(resumeId).run();
	return json({ deleted: true, id: resumeId });
}

// ─── Router ──────────────────────────────────────────────────────────────────

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		// Handle CORS preflight
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}

		const url = new URL(request.url);
		const path = url.pathname;

		// Health check (no auth required)
		if (request.method === "GET" && path === "/health") {
			return json({ status: "ok", timestamp: new Date().toISOString() });
		}

		// Auth check
		if (!isAuthorized(request)) {
			return unauthorized();
		}

		// Bootstrap tables on first request (idempotent)
		await ensureTables(env.DB);

		// POST /searches
		if (request.method === "POST" && path === "/searches") {
			return handleSaveSearch(request, env.DB);
		}

		// GET /searches/match?q=...&mode=...
		if (request.method === "GET" && path === "/searches/match") {
			return handleMatchSearch(url, env.DB);
		}

		// GET /searches/similar?q=...
		if (request.method === "GET" && path === "/searches/similar") {
			return handleSimilarSearches(url, env.DB);
		}

		// GET /searches/autocomplete?q=...
		if (request.method === "GET" && path === "/searches/autocomplete") {
			return handleAutocomplete(url, env.DB);
		}

		// DELETE /searches/:id
		const deleteMatch = path.match(/^\/searches\/(\d+)$/);
		if (request.method === "DELETE" && deleteMatch) {
			return handleDeleteSearch(Number(deleteMatch[1]), env.DB);
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

		// GET /searches
		if (request.method === "GET" && path === "/searches") {
			return handleListSearches(url, env.DB);
		}

		// POST /resume
		if (request.method === "POST" && path === "/resume") {
			return handleSaveResume(request, env.DB);
		}

		// GET /resume
		if (request.method === "GET" && path === "/resume") {
			return handleGetResume(url, env.DB);
		}

		// DELETE /resume/:id
		const resumeDelete = path.match(/^\/resume\/(\d+)$/);
		if (request.method === "DELETE" && resumeDelete) {
			return handleDeleteResume(Number(resumeDelete[1]), env.DB);
		}

		// Fallback
		return json({
			message: "Mergex LeadGen API",
			version: "2.0.0",
			endpoints: {
				"GET /health": "Health check (no auth)",
				"POST /searches": "Save search results",
				"GET /searches": "List all searches",
				"GET /searches/match?q=&mode=": "Exact match lookup",
				"GET /searches/similar?q=": "Similar search lookup",
				"GET /searches/autocomplete?q=": "Autocomplete search terms",
				"GET /searches/:id": "Get search + results by id",
				"GET /searches/:id/results": "Get only results by search id",
				"DELETE /searches/:id": "Delete a search + results",
				"POST /resume": "Save resume state",
				"GET /resume": "Get pending resume states",
				"DELETE /resume/:id": "Delete a resume state",
			},
		});
	},
} satisfies ExportedHandler<Env>;
