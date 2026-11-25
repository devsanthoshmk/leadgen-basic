import { afterEach, describe, expect, it, vi } from 'vitest';
import { search } from '../../src/services/scraper.js';

const card = (name, identity, details = '') => `<div class="VkpGBb" ${identity}>
  <div role="heading">${name}</div><div class="rllt__details"><div><div>${details}</div></div></div>
</div>`;
const primary = (...cards) => `<div id="search">${cards.join('')}</div>`;

function mockPages(...pages) {
  const fetch = vi.fn();
  for (const page of pages) fetch.mockResolvedValueOnce({ ok: true, text: async () => page });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('Maps search modes', () => {
  it('uses Maps V2 after a JavaScript interstitial and skips Auto enrichment when Maps supplies a phone', async () => {
    const listing = [];
    listing[11] = 'Alpha';
    listing[78] = 'ChIJAlpha';
    listing[178] = [[null, [['9876543210']]]];
    const data = [];
    data[64] = [[null, listing]];
    const fetch = mockPages('<a href="/httpservice/retry/enablejs">Continue</a>',
      '<link href="/search?tbm=map&amp;pb=!7i20">', `)]}'${JSON.stringify(data)}`, ")]}'[]");
    expect((await search('software')).results[0]).toMatchObject({ title: 'Alpha', completePhoneNumber: '9876543210' });
    expect(decodeURIComponent(fetch.mock.calls[3][0])).toContain('!7i20!8i20');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('Fast reads primary pages only, even without phones', async () => {
    const fetch = mockPages(primary(card('Alpha', 'data-cid="1"')), primary());
    expect((await search('software', 'fast')).results).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Auto skips detail requests when a nested primary result has a phone, even across duplicates', async () => {
    const fetch = mockPages(primary(card('Alpha', 'data-ludocid="1"', '+91 98765 43210'), card('Beta', 'data-cid="2"')),
      primary(card('Alpha', 'data-cid="1"')));
    const { results } = await search('software');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ cid: '1', completePhoneNumber: '+91 98765 43210' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('Auto looks up a CID from a listing link when the primary search finds no phones', async () => {
    const fetch = mockPages(primary(card('Alpha', '', '<a href="/search?q=alpha&amp;ludocid=42">Open</a>')), primary(),
      '<div><span>Phone</span>: 9876543210</div><a href="https://alpha.example"><span>Website</span></a>');
    expect((await search('software')).results[0]).toMatchObject({ cid: '42', completePhoneNumber: '9876543210', url: 'https://alpha.example' });
    expect(fetch.mock.calls[2][0]).toContain('ludocids:42');
  });

  it('Deep checks only missing-phone places and fills address gaps', async () => {
    const fetch = mockPages(primary(card('Alpha', 'data-cid="1"', '9876543210'), card('Beta', 'data-cid="2"')), primary(),
      '<section><div><span>Address</span>: 10 Main Street</div></section>');
    expect((await search('software', 'long')).results[1].address).toBe('10 Main Street');
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[2][0]).toContain('ludocids:2');
  });

  it('resumes Auto fallback without mistaking an enriched phone for a primary hit', async () => {
    mockPages(primary(card('Alpha', 'data-cid="1"'), card('Beta', 'data-cid="2"')), primary(),
      '<section><div><span>Phone</span>: 9876543210</div></section>',
      '<section><div><span>Phone</span>: 8765432109</div></section>');
    const paused = await search('software', 'normal', info => !(info.phase === 'enrich' && info.current === 2));
    expect(paused.resumeState).toMatchObject({ phase: 'enrich', enrichIndex: 1 });
    const completed = await search('software', 'normal', null, paused.resumeState);
    expect(completed.results.map(row => row.completePhoneNumber)).toEqual(['9876543210', '8765432109']);
  });
});
