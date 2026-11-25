const companyKey = name => (name ?? '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  .replace(/\s+(?:(?:private|pvt)\s+)?(?:limited|ltd|inc|llc|llp)$/, '');

export function mergeLeadSources(maps, linkedin) {
  function index(rows) {
    const keys = new Map();
    rows.forEach((row, i) => {
      const key = companyKey(row.title);
      if (key.length >= 5) keys.set(key, keys.has(key) ? -1 : i);
    });
    return keys;
  }
  const mapsKeys = index(maps);
  const linkedinKeys = index(linkedin);
  const used = new Set();
  const merged = maps.map((row, i) => {
    const key = companyKey(row.title);
    const j = linkedinKeys.get(key);
    if (mapsKeys.get(key) !== i || j == null || j < 0) return row;
    const { companyId, linkedinUrl, followers, description, badge } = linkedin[j];
    used.add(j);
    return { ...row, source: 'combined', companyId, linkedinUrl, followers, description, badge };
  });
  return [...merged, ...linkedin.filter((_, i) => !used.has(i))];
}
