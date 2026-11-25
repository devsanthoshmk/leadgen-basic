import { expect, it } from 'vitest';
import { withLeadScore } from '../../src/services/leadScoring.js';

it('uses mapScraper tiers without awarding unavailable enrichment', () => {
  const lead = { reviews: 500, stars: 4.5, url: 'https://example.com', completePhoneNumber: '1234567890' };
  expect(withLeadScore(lead)).toMatchObject({ score: 80, segment: 'Large', scoreBasis: 'Maps signals' });
  expect(withLeadScore({ ...lead, source: 'combined', followers: '1M followers' }).score).toBe(80);
  expect(withLeadScore({ ...lead, domain_valid: true, web_has_contact: true, web_has_services: true, web_is_modern: true }).score).toBe(100);
});

it('ranks a relevant LinkedIn company above an unrelated company with more followers', () => {
  const source = 'linkedin';
  const query = 'Software in Chennai';
  const relevant = withLeadScore({ source, title: 'Acme Software', category: 'IT • Chennai', followers: '578 followers' }, query);
  const popular = withLeadScore({ source, title: 'Acme Foods', category: 'Food • Mumbai', followers: '1.2M followers' }, query);
  expect(relevant).toMatchObject({ score: 90, scoreBasis: 'LinkedIn match' });
  expect(popular.score).toBe(20);
});

it('preserves valid supplied scores and handles missing data', () => {
  expect(withLeadScore({ score: 0, stars: 5 })).toMatchObject({ score: 0, scoreBasis: 'Provided', segment: 'Micro' });
  expect(withLeadScore({ score: Infinity, stars: '4.1' }).score).toBe(20);
  expect(withLeadScore({}).score).toBe(0);
});
