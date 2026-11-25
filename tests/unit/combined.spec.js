import { expect, it } from 'vitest';
import { mergeLeadSources } from '../../src/services/combined.js';

it('merges a unique match, retains Maps fields, and keeps unmatched leads', () => {
  const maps = [{ title: 'Acme Software Pvt Ltd', completePhoneNumber: '123', source: 'google-maps' }, { title: 'Other Shop' }];
  const linkedin = [{ title: 'ACME SOFTWARE', companyId: '42', followers: '120 followers' }, { title: 'Different Company' }];
  expect(mergeLeadSources(maps, linkedin)).toEqual([
    expect.objectContaining({ ...maps[0], source: 'combined', companyId: '42', followers: '120 followers' }), maps[1], linkedin[1],
  ]);
});

it('does not merge ambiguous names or discard results when one source fails', () => {
  const maps = [{ title: 'Acme Software', address: 'Branch A' }, { title: 'Acme Software', address: 'Branch B' }];
  const linkedin = [{ title: 'Acme Software' }];
  expect(mergeLeadSources(maps, linkedin)).toEqual([...maps, ...linkedin]);
  expect(mergeLeadSources(maps, [])).toEqual(maps);
  expect(mergeLeadSources([], linkedin)).toEqual(linkedin);
});
