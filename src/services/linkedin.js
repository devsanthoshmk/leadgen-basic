import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

const LinkedInSession = registerPlugin('LinkedInSession');

// ── GEO_URN_MAP (matches ../linkedin-scraper.js) ─────────────────────────────
const GEO_URN_MAP = {
  india: '105214829', mumbai: '106164952', delhi: '106166691',
  bengaluru: '105940533', bangalore: '105940533', chennai: '106888327',
  hyderabad: '106694358', pune: '106732087', kolkata: '105763473',
  ahmedabad: '105186582', kochi: '105968639', coimbatore: '106072425',
  jaipur: '105848183', chandigarh: '106094370', gurugram: '106165353',
  gurgaon: '106165353', noida: '106693232', thane: '106846986',
  'navi mumbai': '102956297', usa: '103644278', 'united states': '103644278',
  'new york': '105080838', 'san francisco bay area': '90000084',
  london: '101165590', 'united kingdom': '101165590',
  singapore: '104738515', dubai: '106481873', uae: '106481873',
};

function resolveGeoUrn(location) {
  if (!location) return null;
  const s = String(location).trim();
  if (/^\d+$/.test(s)) return s;
  return GEO_URN_MAP[s.toLowerCase()] ?? null;
}

function makeTrackPayload() {
  return {
    clientVersion: '1.13.43510', mpVersion: '1.13.43510',
    osName: 'Android', timezoneOffset: 5.5, timezone: 'Asia/Kolkata',
    deviceFormFactor: 'DESKTOP', mpName: 'voyager-web',
    displayDensity: 2, displayWidth: 1080, displayHeight: 2400,
  };
}

function buildHeaders({ cookie, csrf, keywords, geoUrn }) {
  const pi = 'j8aQsSy5Q4OMnvQZbAdDTA==';
  const referer = geoUrn
    ? `https://www.linkedin.com/search/results/companies/?companyHqGeo=%5B%22${geoUrn}%22%5D&keywords=${encodeURIComponent(keywords)}&origin=FACETED_SEARCH`
    : `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(keywords)}&origin=GLOBAL_SEARCH_HEADER`;
  return {
    Accept: 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Cookie: cookie,
    Pragma: 'no-cache',
    Referer: referer,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
    'csrf-token': csrf,
    'x-li-lang': 'en_US',
    'x-li-page-instance': `urn:li:page:d_flagship3_search_srp_companies;${pi}`,
    'x-li-pem-metadata': 'Voyager - Companies SRP=search-results',
    'x-li-track': JSON.stringify(makeTrackPayload()),
    'x-restli-protocol-version': '2.0.0',
  };
}

function normalizeCompany(item) {
  const name = item?.title?.text ?? item?.name ?? '';
  const location = item?.primarySubtitle?.text ?? '';
  const followers = item?.secondarySubtitle?.text ?? '';
  const description = item?.summary?.text ?? '';
  const entityUrn = item?.entityUrn ?? '';
  const companyId = entityUrn.split(':').at(-1) ?? '';
  const navUrl = item?.navigationUrl ?? '';
  let linkedinUrl = '';
  try {
    const u = new URL(navUrl);
    if (/(^|\.)linkedin\.com$/.test(u.hostname) && u.pathname.startsWith('/company/')) {
      linkedinUrl = `${u.origin}${u.pathname}`;
    }
  } catch { /* no nav url */ }
  const badge = item?.badgeText?.text ?? '';
  return { source: 'linkedin', companyId, title: name, category: location, followers, description, badge, linkedinUrl, address: '', completePhoneNumber: '', url: '' };
}

function parseResults(raw) {
  const payload = raw?.data?.data?.searchDashClustersByAll ?? {};
  const elements = payload?.elements ?? [];
  const companies = [];
  for (const cluster of elements) {
    for (const item of (cluster?.items ?? [])) {
      const entity = item?.item?.entityResult;
      if (entity?.entityUrn?.includes(':company:')) {
        const c = normalizeCompany(entity);
        if (c.title) companies.push(c);
      }
    }
  }
  return companies;
}

async function voyagerSearch({ cookie, csrf, keywords, geoUrn, start }) {
  const params = geoUrn
    ? `(key:companyHqGeo,value:List(${geoUrn})),(key:resultType,value:List(COMPANIES))`
    : `(key:resultType,value:List(COMPANIES))`;
  const origin = geoUrn ? 'FACETED_SEARCH' : 'GLOBAL_SEARCH_HEADER';
  const variablesRaw =
    `(start:${start},origin:${origin},query:(keywords:${keywords},` +
    `flagshipSearchIntent:SEARCH_SRP,queryParameters:List(${params}),includeFiltersInResponse:false))`;
  const url =
    'https://www.linkedin.com/voyager/api/graphql' +
    `?includeWebMetadata=true&variables=${variablesRaw.replaceAll(' ', '%20')}` +
    '&queryId=voyagerSearchDashClusters.843215f2a3455f1bed85762a45d71be8';

  const response = await CapacitorHttp.get({
    url,
    headers: buildHeaders({ cookie, csrf, keywords, geoUrn }),
    connectTimeout: 10000,
    readTimeout: 25000,
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error('SESSION_EXPIRED');
  }
  if (response.status !== 200) {
    throw new Error(`LinkedIn returned ${response.status}`);
  }
  return parseResults(typeof response.data === 'string' ? JSON.parse(response.data) : response.data);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns true if a LinkedIn session is saved on-device. */
export async function hasLinkedInSession() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await LinkedInSession.hasSession();
    return r.value === true;
  } catch { return false; }
}

export async function hasNotificationAccess() {
  if (!Capacitor.isNativePlatform()) return true;
  try { return (await LinkedInSession.hasNotificationAccess()).value === true; } catch { return false; }
}

export async function openNotificationSettings() {
  if (Capacitor.isNativePlatform()) await LinkedInSession.openNotificationSettings();
}

/** Opens the in-app LinkedIn login.
 *  Pass { email, password } to auto-fill the form; omit for manual login.
 */
export async function linkedInLogin({ email, password } = {}) {
  if (email && password) {
    await LinkedInSession.autoLogin({ email, password });
  } else {
    await LinkedInSession.login();
  }
}

/** Clears the saved session so the user can log in again. */
export async function clearLinkedInSession() {
  await LinkedInSession.clearSession();
}

/**
 * Search LinkedIn companies on-device using the saved browser session.
 * Falls back to the USB bridge URL if set (dev only).
 */
export async function searchLinkedIn(keywords, location, mode) {
  const pages = { fast: 1, normal: 3, long: 5 }[mode] ?? 1;
  const geoUrn = resolveGeoUrn(location);

  // --- on-device path (native only) ---
  if (Capacitor.isNativePlatform()) {
    let session;
    try {
      session = await LinkedInSession.getSession();
    } catch {
      throw new Error('No LinkedIn session. Tap "Sign in to LinkedIn" in Settings first.');
    }

    const leads = new Map();
    for (let page = 0; page < pages; page++) {
      let companies;
      try {
        companies = await voyagerSearch({ cookie: session.cookie, csrf: session.csrf, keywords, geoUrn, start: page * 10 });
      } catch (err) {
        if (err.message === 'SESSION_EXPIRED') {
          await clearLinkedInSession();
          throw new Error('Your LinkedIn session expired. Please sign in again from Settings.');
        }
        throw err;
      }
      const before = leads.size;
      for (const c of companies) leads.set(c.companyId || c.linkedinUrl || `${c.title}:${c.category}`, c);
      if (companies.length < 10 || leads.size === before) break;
    }
    return [...leads.values()];
  }

  // --- dev fallback: USB bridge ---
  const bridgeUrl = import.meta.env.VITE_LINKEDIN_BRIDGE_URL;
  if (!bridgeUrl) throw new Error('LinkedIn search requires the app to run on Android.');
  const leads = new Map();
  for (let page = 0; page < pages; page++) {
    const r = await fetch(`${bridgeUrl.replace(/\/$/, '')}/companies?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location ?? '')}&start=${page * 10}`, {
      headers: { 'X-LeadGen-Client': 'android' },
    });
    if (!r.ok) throw new Error((await r.json()).error || `LinkedIn bridge error ${r.status}`);
    const data = await r.json();
    const before = leads.size;
    for (const c of data.rows) leads.set(c.companyId || c.linkedinUrl || `${c.title}:${c.category}`, c);
    if (!data.hasMore || leads.size === before) break;
  }
  return [...leads.values()];
}
