import { createServer } from 'node:http';

const moduleUrl = process.env.LEADGEN_LINKEDIN_MODULE || new URL('../../linkedin-scraper.js/module/linkedin-search.js', import.meta.url).href;
const { searchCompanies, searchGeoLocations, _resolveGeoUrn } = await import(moduleUrl);
const port = Number(process.env.LEADGEN_LINKEDIN_PORT || 8765);
let busy = false;

createServer(async (req, res) => {
  const reply = (status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  if (req.method !== 'GET' || req.headers['x-leadgen-client'] !== 'android') return reply(404, {});
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/companies') return reply(404, {});
  const keywords = url.searchParams.get('keywords')?.trim();
  const location = url.searchParams.get('location')?.trim();
  const start = Number(url.searchParams.get('start') ?? 0);
  if (!keywords || !/^[\p{L}\p{M}\p{N} .'-]{1,100}$/u.test(keywords) ||
      (location && !/^[\p{L}\p{M}\p{N} .,'-]{1,100}$/u.test(location)) ||
      !Number.isInteger(start) || start < 0 || start > 90 || start % 10 !== 0) {
    return reply(400, { error: 'Enter a company keyword and optional city using letters and numbers.' });
  }
  if (!process.env.LI_COOKIE || !process.env.LI_CSRF_TOKEN) return reply(503, { error: 'The LinkedIn scraper has no saved session.' });
  if (busy) return reply(429, { error: 'Another LinkedIn request is in progress. Try again shortly.' });
  busy = true;
  try {
    let geo = location ? _resolveGeoUrn(location) : null;
    if (location && !geo) {
      const result = await searchGeoLocations({ keywords: location });
      const match = result.locations?.find(row => row.title?.toLowerCase() === location.toLowerCase());
      geo = match?.geoId;
      if (!geo) return reply(400, { error: 'Location not recognized. Try a major city or leave it blank.' });
    }
    const [result] = await searchCompanies({ keywords, location: geo, start, count: 10 });
    const rows = result.companies.map(company => {
      const record = company.toDict();
      let linkedinUrl = '';
      try {
        const link = new URL(record.url);
        if (link.protocol === 'https:' && /(^|\.)linkedin\.com$/.test(link.hostname) && link.pathname.startsWith('/company/')) {
          linkedinUrl = `${link.origin}${link.pathname}`;
        }
      } catch { /* Missing company link */ }
      return {
        source: 'linkedin', companyId: record.company_id, title: record.name,
        category: record.location, followers: record.followers, description: record.description,
        badge: record.badge_text, linkedinUrl, address: '', completePhoneNumber: '', url: '',
      };
    }).filter(row => row.title);
    reply(200, { rows, hasMore: result.companies.length >= 10 });
  } catch (error) {
    reply(502, { error: /HTTP (401|403)/.test(error.message) ? 'LinkedIn rejected the saved session. Refresh it on the computer.' : 'LinkedIn search failed on the computer.' });
  } finally {
    busy = false;
  }
}).listen(port, '127.0.0.1', () => console.log(`LinkedIn bridge listening on 127.0.0.1:${port}`));
