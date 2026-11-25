import { expect, it } from 'vitest';
import { withLeadScore } from '../../src/services/leadScoring.js';

it('prioritizes a reachable fitness studio over a popular park mentioning gyms', () => {
  const query = 'gyms in Bengaluru';
  const gym = withLeadScore({ category: 'Fitness Studio', address: 'Bangalore', completePhoneNumber: '+91 9876543210', stars: 4.5, reviews: 10 }, query);
  const park = withLeadScore({ title: 'Park with gym', category: 'Park', address: 'Bangalore', stars: 5, reviews: 500 }, query);
  expect(gym.scoreBreakdown.searchFit).toBe(45);
  expect(gym.score).toBeGreaterThan(park.score);
});

it('dampens thin reviews and caps follower influence', () => {
  expect(withLeadScore({ stars: 4.5, reviews: 200 }).score).toBeGreaterThan(withLeadScore({ stars: 5, reviews: 1 }).score);
  expect(withLeadScore({ source: 'linkedin', followers: '1.2M followers' }).score).toBe(9);
});

it('counts LinkedIn evidence only for corroborated merges and always recalculates legacy scores', () => {
  const row = { source: 'combined', title: 'Acme', score: 99, linkedinUrl: 'https://www.linkedin.com/company/acme/', followers: '1,000 followers' };
  expect(withLeadScore(row)).toMatchObject({ score: 0, scoreVersion: 2, evidenceCoverage: 'Limited' });
  expect(withLeadScore({ ...row, matchVerified: true }).score).toBeGreaterThan(4);
  expect(withLeadScore({ completePhoneNumber: '123', url: 'javascript:alert(1)' }).score).toBe(0);
});

it('keeps every pillar within its budget', () => {
  const row = { source: 'combined', matchVerified: true, category: 'Software', address: 'Chennai', reviews: 100000, stars: 5,
    completePhoneNumber: '9876543210', url: 'https://example.com', linkedinUrl: 'https://www.linkedin.com/company/acme/', followers: '1M' };
  expect(withLeadScore(row, 'software in Chennai')).toMatchObject({ score: 100, scoreBreakdown: { searchFit: 45, reachability: 35, credibility: 20 } });
});
