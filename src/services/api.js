/**
 * @module api
 * @description Centralized API client for the Mergex LeadGen Worker backend.
 * Reads VITE_API_URL and VITE_API_PASSWORD from environment.
 */

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');
const API_PASSWORD = import.meta.env.VITE_API_PASSWORD || 'mergex-leadgen';
const TIMEOUT_MS = 15_000;

async function request(path, options = {}) {
  const { method = 'GET', body, timeout = TIMEOUT_MS } = options;
  const url = `${API_URL}${path}${path.includes('?') ? '&' : '?'}password=${encodeURIComponent(API_PASSWORD)}`;

  const tag = `[CloudSync] ${method} ${path}`;
  console.log(`${tag} → sending`, body ? { bodyKeys: Object.keys(body), bodySize: JSON.stringify(body).length } : '(no body)');
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const elapsed = Date.now() - start;

    const data = await res.json();
    if (!res.ok) {
      console.warn(`${tag} ✗ HTTP ${res.status} in ${elapsed}ms:`, data.error || data);
      return { ok: false, data: null, error: data.error || `HTTP ${res.status}` };
    }
    console.log(`${tag} ✓ ${res.status} in ${elapsed}ms`, data ? { dataKeys: Object.keys(data) } : '');
    return { ok: true, data, error: null };
  } catch (err) {
    const elapsed = Date.now() - start;
    if (err.name === 'AbortError') {
      console.error(`${tag} ✗ timed out after ${elapsed}ms (limit: ${timeout}ms)`);
      return { ok: false, data: null, error: 'Request timed out' };
    }
    if (!navigator.onLine) {
      console.warn(`${tag} ✗ offline after ${elapsed}ms`);
      return { ok: false, data: null, error: 'offline' };
    }
    console.error(`${tag} ✗ ${err.message} after ${elapsed}ms`);
    return { ok: false, data: null, error: err.message };
  }
}

/** Check if the API is reachable (no auth required) */
export async function checkHealth() {
  const start = Date.now();
  const result = await request('/health', { timeout: 5000 });
  return { ...result, latency: Date.now() - start };
}

/** Exact match: same query + mode */
export async function matchSearch(query, mode) {
  return request(`/searches/match?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`);
}

/** Similar queries via LIKE */
export async function findSimilar(query, limit = 5) {
  return request(`/searches/similar?q=${encodeURIComponent(query)}&limit=${limit}`);
}

/** Save a completed search + results to cloud */
export async function saveSearch(query, mode, results) {
  return request('/searches', { method: 'POST', body: { query, mode, results }, timeout: 30_000 });
}

/** List all searches (paginated) */
export async function getSearches(limit = 50, offset = 0) {
  return request(`/searches?limit=${limit}&offset=${offset}`);
}

/** Get a specific search + results */
export async function getSearch(id) {
  return request(`/searches/${id}`);
}

/** Delete a search */
export async function deleteSearch(id) {
  return request(`/searches/${id}`, { method: 'DELETE' });
}

/** Save resume state for cross-device resumability */
export async function saveResumeState(data) {
  return request('/resume', { method: 'POST', body: data, timeout: 10_000 });
}

/** Get pending resume states */
export async function getResumeStates() {
  return request('/resume');
}

/** Delete a resume state */
export async function deleteResumeState(id) {
  return request(`/resume/${id}`, { method: 'DELETE' });
}
