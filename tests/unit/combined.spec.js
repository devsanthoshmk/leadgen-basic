import { expect, it } from 'vitest';
import { mergeLeadSources } from '../../src/services/combined.js';

it('merges a unique match, retains Maps fields, and keeps unmatched leads', () => {
  const maps = [{ title: 'Acme Software Pvt Ltd', address: '10 Main Street, Madras', completePhoneNumber: '123', source: 'google-maps' }, { title: 'Other Shop' }];
  const linkedin = [{ title: 'ACME SOFTWARE', category: 'IT • Chennai, Tamil Nadu', companyId: '42', followers: '120 followers' }, { title: 'Different Company' }];
  expect(mergeLeadSources(maps, linkedin)).toEqual([
    expect.objectContaining({ ...maps[0], source: 'combined', matchVerified: true, linkedinCategory: linkedin[0].category, companyId: '42', followers: '120 followers' }), maps[1], linkedin[1],
  ]);
});

it('does not merge ambiguous names or discard results when one source fails', () => {
  const maps = [{ title: 'Acme Software', address: 'Branch A, Chennai' }, { title: 'Acme Software', address: 'Branch B, Chennai' }];
  const linkedin = [{ title: 'Acme Software', category: 'IT • Chennai, Tamil Nadu' }];
  expect(mergeLeadSources(maps, linkedin)).toEqual([...maps, ...linkedin]);
  expect(mergeLeadSources(maps, [])).toEqual(maps);
  expect(mergeLeadSources([], linkedin)).toEqual(linkedin);
});

it('keeps same-name companies separate if city evidence conflicts or is missing', () => {
  const maps = [{ title: 'Green Cafe', address: 'Chennai' }];
  for (const category of ['Food • Mumbai', 'Food • Tamil Nadu', 'Food']) {
    const linkedin = [{ title: 'Green Cafe', category }];
    expect(mergeLeadSources(maps, linkedin, 'cafes in Chennai')).toEqual([...maps, ...linkedin]);
  }
});
