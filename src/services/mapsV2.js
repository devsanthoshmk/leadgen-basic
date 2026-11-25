// Port of mapScraper/mapScraper/placesCrawlerV2.py's Maps response format.
const origin = 'https://www.google.com';
export const mapsPageSize = 20;

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Maps returned HTTP ${response.status}.`);
  return response.text();
}

export async function resolveMapsSearch(query) {
  const html = await getText(`${origin}/maps/search/${encodeURIComponent(query)}?hl=en&gl=in`);
  const path = html.match(/href="(\/search\?tbm=map[^\"]+)"/)?.[1];
  if (!path) throw new Error('Google Maps did not return a listings URL.');
  return new URL(path.replaceAll('&amp;', '&'), origin).href;
}

export async function fetchMapsPage(searchUrl, offset) {
  const url = new URL(searchUrl);
  if (url.origin !== origin || url.pathname !== '/search' || url.searchParams.get('tbm') !== 'map') {
    throw new Error('Invalid Maps listings URL.');
  }
  if (offset) {
    const pb = url.searchParams.get('pb') ?? '';
    if (/!8i\d+/.test(pb)) url.searchParams.set('pb', pb.replace(/!8i\d+/, `!8i${offset}`));
    else if (/!7i\d+/.test(pb)) url.searchParams.set('pb', pb.replace(/!7i\d+/, `$&!8i${offset}`));
    else url.searchParams.set('start', String(offset));
  }
  const raw = await getText(url.href);
  if (!raw.startsWith(")]}'")) throw new Error('Google Maps did not return listing data.');
  const data = JSON.parse(raw.slice(4));
  const places = Array.isArray(data?.[64]) ? data[64].map(entry => entry?.[1]) : [data?.[0]?.[1]?.[0]?.[14]];
  return places.filter(place => typeof place?.[78] === 'string' && place[78] && typeof place[11] === 'string').map(place => {
    const hex = typeof place[10] === 'string' ? place[10].match(/:((?:0x)[a-f\d]+)$/i)?.[1] : null;
    return {
      placeId: place[78],
      cid: hex && typeof BigInt === 'function' ? BigInt(hex).toString() : '',
      title: place[11],
      category: place[13]?.[0] ?? '',
      address: place[39] ?? '',
      stars: Number(place[4]?.[7]) || 0,
      reviews: Number(place[37]?.[1]) || 0,
      completePhoneNumber: place[178]?.[0]?.[1]?.[1]?.[0] || place[178]?.[0]?.[1]?.[0]?.[0] || '',
      url: /^https?:\/\//i.test(place[7]?.[0] ?? '') ? place[7][0] : '',
    };
  });
}
