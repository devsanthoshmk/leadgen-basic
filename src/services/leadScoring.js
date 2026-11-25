const number = value => {
  const parsed = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
};

const points = (value, tiers) => tiers.find(([minimum]) => value >= minimum)?.[1] ?? 0;
const tokens = value => String(value ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const overlap = (words, text) => {
  if (!words.length) return 0;
  const available = new Set(tokens(text));
  return words.filter(word => available.has(word)).length / words.length;
};

function linkedinScore(row, query) {
  const [, keyword, city = ''] = query.trim().match(/^(.+?)\s+in\s+(.+)$/i) ?? ['', query];
  const words = [...new Set(tokens(keyword))];
  const titleFit = overlap(words, `${row.title ?? ''} ${row.category ?? ''}`);
  const widerFit = overlap(words, `${row.title ?? ''} ${row.category ?? ''} ${row.description ?? ''}`);
  const location = (row.category ?? '').split('•').pop();
  const followers = String(row.followers ?? '').trim().match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kmb])?\s*(?:followers?)?$/i);
  const count = followers ? number(followers[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6, b: 1e9 }[followers[2]?.toLowerCase()] ?? 1) : 0;
  return (city ? 45 * titleFit + 15 * widerFit + 20 * overlap(tokens(city), location) : 60 * titleFit + 20 * widerFit) +
    points(count, [[10000, 20], [1000, 15], [100, 10], [1, 5]]);
}

function mapsScore(row) {
  const reviews = points(number(row.reviews), [[500, 30], [200, 24], [100, 18], [50, 12], [10, 7], [1, 3]]);
  const rating = number(row.stars);
  const stars = points(rating, [[4.5, 25], [4, 20], [3.5, 15], [3, 10]]) || (rating > 0 ? 5 : 0);
  let website = row.has_website === true || Boolean(row.url?.trim() || row.domain?.trim()) ? 10 : 0;
  for (const key of ['domain_valid', 'web_has_contact', 'web_has_services', 'web_is_modern']) {
    if (row[key] === true) website += 5;
  }
  const phone = row.has_phone === true || Boolean(row.completePhoneNumber?.trim() || row.phoneNumber?.trim()) ? 15 : 0;
  return reviews + stars + website + phone;
}

export function withLeadScore(row, query = '') {
  const hasScore = typeof row.score === 'number' && Number.isFinite(row.score) && row.score >= 0 && row.score <= 100;
  const linkedin = row.source === 'linkedin';
  const score = hasScore ? row.score : Math.round((linkedin ? linkedinScore(row, query) : mapsScore(row)) * 10) / 10;
  const segment = score < 25 ? 'Micro' : score < 50 ? 'Small' : score < 75 ? 'Medium' : 'Large';
  return { ...row, score, scoreBasis: hasScore ? (row.scoreBasis || 'Provided') : linkedin ? 'LinkedIn match' : 'Maps signals', segment };
}
