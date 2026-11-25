const text = value => typeof value === 'string' ? value.trim() : '';
const number = value => (typeof value === 'number' || typeof value === 'string') && Number.isFinite(Number(value)) ? Number(value) : 0;
const aliases = [
  [/\b(?:gyms?|fitness (?:centers?|centres?|studios?))\b/g, 'gym'],
  [/\b(?:cafes?|coffee shops?)\b/g, 'cafe'],
  [/\b(?:bengaluru|bangalore)\b/g, 'bangalore'],
  [/\b(?:madras|chennai)\b/g, 'chennai'],
  [/\b(?:saas|software development|software companies)\b/g, 'software'],
];
const noise = new Set(['a', 'an', 'the', 'and', 'in', 'near', 'best', 'top', 'company', 'companies']);

export function scoreTokens(value) {
  let normalized = text(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  for (const [pattern, replacement] of aliases) normalized = normalized.replace(pattern, replacement);
  return [...new Set((normalized.match(/[\p{L}\p{N}]+/gu) ?? []).filter(word => !noise.has(word)))];
}

export function splitScoreQuery(value) {
  const query = text(value);
  const [, keyword, city = ''] = query.match(/^(.+)\s+in\s+(.+)$/i) ?? ['', query];
  return { keyword, city };
}

const overlap = (words, candidate) => {
  const available = new Set(scoreTokens(candidate));
  return words.length ? words.filter(word => available.has(word)).length / words.length : 0;
};
const round = value => Math.round(value * 10) / 10;
const logPoints = (count, ceiling, max) => max * Math.min(1, Math.log1p(Math.max(0, count)) / Math.log1p(ceiling));

function urlHost(value) {
  try {
    const url = new URL(text(value));
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.hostname.toLowerCase() : '';
  } catch { return ''; }
}

function followerCount(value) {
  const match = String(value ?? '').trim().match(/^(\d+(?:,\d{3})*(?:\.\d+)?)\s*([kmb])?\s*(?:followers?)?$/i);
  return match ? number(match[1].replace(/,/g, '')) * ({ k: 1e3, m: 1e6, b: 1e9 }[match[2]?.toLowerCase()] ?? 1) : 0;
}

export function withLeadScore(row, query = '') {
  const { keyword, city } = splitScoreQuery(query);
  const words = scoreTokens(keyword);
  const cities = scoreTokens(city);
  const linkedin = row.source === 'linkedin';
  const corroborated = row.source === 'combined' && row.matchVerified === true;
  const useLinkedIn = linkedin || corroborated;
  const [industry, liLocation] = text(linkedin ? row.category : corroborated ? row.linkedinCategory : '').split('•');
  const category = linkedin ? industry : `${text(row.category)} ${industry}`;
  const categoryFit = overlap(words, category);
  const nameFit = overlap(words, row.title);
  const descriptionFit = useLinkedIn ? overlap(words, row.description) : 0;
  const keywordFit = Math.max(categoryFit, nameFit * (scoreTokens(category).length ? 0.55 : 0.8), descriptionFit * 0.3);
  const cityFit = overlap(cities, `${text(row.address)} ${liLocation ?? ''}`);
  const searchFit = round((cities.length ? 35 : 45) * keywordFit + (cities.length ? 10 * cityFit : 0));

  const phone = [row.completePhoneNumber, row.complete_phone_number, row.phoneNumber].some(value => /^\d{8,15}$/.test(text(value).replace(/\D/g, '')));
  const host = urlHost(row.url);
  const directory = /(^|\.)(facebook\.com|instagram\.com|linkedin\.com|linktr\.ee|justdial\.com|indiamart\.com|google\.com|wa\.me)$/.test(host);
  const profile = useLinkedIn && /(^|\.)linkedin\.com$/.test(urlHost(row.linkedinUrl)) && /\/company\/[^/?#]+/.test(text(row.linkedinUrl));
  const address = Boolean(text(row.address));
  // Phone and first-party website are the strongest actionable signals.
  const reachability = (phone ? 17 : 0) + (host ? directory ? 5 : 12 : 0) + (profile ? 4 : 0) + (address ? 2 : 0);

  const reviews = linkedin ? 0 : Math.max(0, number(row.reviews));
  const stars = Math.max(0, Math.min(5, number(row.stars)));
  const mapsCredibility = logPoints(reviews, 500, 12) + 8 * Math.max(0, (stars - 2.5) / 2.5) * (reviews / (reviews + 15));
  const followers = useLinkedIn ? followerCount(row.followers) : 0;
  const linkedinCredibility = logPoints(followers, 100000, 9);
  const credibility = round(Math.min(20, Math.max(mapsCredibility, linkedinCredibility) + 0.25 * Math.min(mapsCredibility, linkedinCredibility)));

  const score = round(searchFit + reachability + credibility);
  const reasons = [categoryFit === 1 && words.length ? 'Category match' : keywordFit ? 'Partial keyword fit' : words.length ? 'Keyword fit unconfirmed' : 'No query context',
    phone ? 'Phone listed' : host && !directory ? 'Website listed' : profile ? 'LinkedIn profile listed' : host ? 'Directory or social link listed' : 'No outreach channel found'];
  if (cities.length) reasons.push(cityFit === 1 ? 'City matches' : 'City unconfirmed');
  const coverage = [Boolean(words.length), Boolean(!cities.length || cityFit === 1), Boolean(scoreTokens(category).length), Boolean(phone || host || profile), Boolean(reviews || followers)].filter(Boolean).length;
  const evidenceCoverage = coverage >= 5 ? 'High' : coverage >= 3 ? 'Moderate' : 'Limited';
  const segment = score >= 80 ? 'Top' : score >= 60 ? 'High' : score >= 40 ? 'Moderate' : 'Low';
  return { ...row, score, scoreVersion: 2, scoreBasis: reasons.join(' · '), segment, evidenceCoverage,
    scoreBreakdown: { searchFit, reachability, credibility } };
}
