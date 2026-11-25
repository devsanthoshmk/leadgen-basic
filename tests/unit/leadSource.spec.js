import { expect, it } from 'vitest';
import { leadSourceLabel, matchesLeadSource } from '../../src/services/leadSource.js';

it('labels LinkedIn, Maps, combined, and previously saved Maps rows', () => {
  expect(leadSourceLabel({ source: 'linkedin' })).toBe('LinkedIn');
  expect(leadSourceLabel({ source: 'google-maps' })).toBe('Google Maps');
  expect(leadSourceLabel({ source: 'combined' })).toBe('Google Maps + LinkedIn');
  expect(leadSourceLabel({})).toBe('Google Maps');
});

it('filters by source and includes combined rows under either provider', () => {
  const rows = [{}, { source: 'linkedin' }, { source: 'combined' }];
  expect(rows.filter(row => matchesLeadSource(row, 'google-maps'))).toEqual([rows[0], rows[2]]);
  expect(rows.filter(row => matchesLeadSource(row, 'linkedin'))).toEqual([rows[1], rows[2]]);
  expect(rows.filter(row => matchesLeadSource(row, 'all'))).toEqual(rows);
});
