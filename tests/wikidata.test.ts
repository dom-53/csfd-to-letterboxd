import { describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/wikidata-great-train-robbery.json';
import { createWikidataLookup, parseWikidata, wikidataUrl, WIKIDATA_ENDPOINT } from '../src/core/providers/wikidata';

const id = '167098';

describe('Wikidata v2', () => {
  it('sends a GET with only the validated ČSFD ID and safe fetch options', async () => {
    const http = vi.fn<typeof fetch>(async () => Response.json(fixture));
    const result = await createWikidataLookup({ fetch: http })(id);
    expect(result).toEqual({ kind: 'match', ids: {
      imdbId: 'tt0000439', tmdbId: '5698', letterboxdSlug: 'the-great-train-robbery',
    } });
    const [url, options] = http.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect(String(url)).toMatch(new RegExp('^' + WIKIDATA_ENDPOINT.replaceAll('.', '\\.') + '\\?'));
    expect((url as URL).searchParams.get('query')).toContain('wdt:P2529 "167098" .');
    expect(options).toMatchObject({
      method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
      headers: { Accept: 'application/sparql-results+json', 'Api-User-Agent': expect.stringContaining('csfd-to-letterboxd/') },
    });
  });

  it('rejects invalid input before constructing a query or fetching', async () => {
    const http = vi.fn<typeof fetch>();
    await expect(createWikidataLookup({ fetch: http })('1" }')).resolves.toEqual({ kind: 'not_found' });
    expect(() => wikidataUrl('1" }')).toThrow(TypeError);
    expect(http).not.toHaveBeenCalled();
  });

  it('distinguishes no result, malformed data and unusable identifiers', () => {
    expect(parseWikidata({ results: { bindings: [] } })).toEqual({ kind: 'not_found' });
    expect(parseWikidata({ results: { bindings: [{}] } })).toEqual({ kind: 'unavailable' });
    const film = { value: 'http://www.wikidata.org/entity/Q470329' };
    expect(parseWikidata({ results: { bindings: [{ film, letterboxd: { value: '../bad' } }] } }))
      .toEqual({ kind: 'not_found' });
  });

  it('groups repeated rows and rejects conflicts within or between entities', () => {
    const first = fixture.results.bindings[0]!;
    const parse = (...bindings: unknown[]) => parseWikidata({ results: { bindings } });
    expect(parse(first, first)).toMatchObject({ kind: 'match' });
    expect(parse(first, { ...first, imdb: { value: 'tt0000417' } })).toEqual({ kind: 'conflict' });
    expect(parse(first, { ...first, film: { value: 'http://www.wikidata.org/entity/Q244971' } }))
      .toEqual({ kind: 'conflict' });
  });

  it('coalesces simultaneous requests for the same film', async () => {
    const http = vi.fn<typeof fetch>(async () => Response.json(fixture));
    const lookup = createWikidataLookup({ fetch: http });
    await Promise.all([lookup(id), lookup(id)]);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After across lookup instances without sleeping or retrying', async () => {
    let now = 10_000;
    let until: number | undefined;
    const cooldown = {
      get: async () => until,
      set: async (time: number) => { until = time; },
    };
    const http = vi.fn<typeof fetch>(async () => Response.json(fixture))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '10' } }));
    const options = { fetch: http, now: () => now, cooldown };
    expect(await createWikidataLookup(options)(id)).toEqual({ kind: 'rate_limited' });
    now += 9_000;
    expect(await createWikidataLookup(options)('47384')).toEqual({ kind: 'rate_limited' });
    expect(http).toHaveBeenCalledTimes(1);
    now += 1_000;
    expect(await createWikidataLookup(options)(id)).toMatchObject({ kind: 'match' });
  });

  it('aborts at the deadline and distinguishes a 5xx response', async () => {
    const http = vi.fn<typeof fetch>(async (_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true });
      });
    });
    expect(await createWikidataLookup({ fetch: http, timeoutMs: 5 })(id)).toEqual({ kind: 'timeout' });
    http.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expect(await createWikidataLookup({ fetch: http })(id)).toEqual({ kind: 'unavailable' });
  });
});
