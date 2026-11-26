import { describe, expect, it, vi } from 'vitest';
import { directUrl, searchUrl } from '../src/core/letterboxd';
import { resolveFilm } from '../src/core/resolver';
import { DEFAULT_SETTINGS } from '../src/core/types';
import type { CacheEntry, Film, Settings } from '../src/core/types';

const film: Film = { type: 'Movie', csfdId: '167098', title: 'Přepadení vlaku', year: 1903, directors: [] };
const csfd = { ...film, imdbId: 'tt0000439' };
const slug = { letterboxdSlug: 'the-great-train-robbery' };
const entry: CacheEntry = { version: 1, csfdId: film.csfdId, provider: 'wikidata', ids: slug, obtainedAt: 1 };
const { notFound, match } = { notFound: { kind: 'not_found' }, match: { kind: 'match', ids: slug } } as const;

function setup(update: Partial<Settings> = {}) {
  const wikidata = vi.fn(async () => match);
  const get = vi.fn<() => Promise<CacheEntry | undefined>>(async () => undefined);
  const put = vi.fn(async () => undefined);
  const resolve = (value = film) => resolveFilm(value, { ...DEFAULT_SETTINGS, ...update }, { wikidata, cache: { get, put } });
  return { wikidata, get, put, resolve };
}

describe('lookup modes', () => {
  it('uses the live ČSFD link before the cache or network', async () => {
    const { resolve, wikidata, get, put } = setup();
    expect(await resolve(csfd)).toEqual({
      kind: 'direct', provider: 'csfd', cached: false, url: 'https://letterboxd.com/imdb/tt0000439',
    });
    expect(get).not.toHaveBeenCalled();
    expect(wikidata).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith(film.csfdId, 'csfd', { imdbId: csfd.imdbId });
  });

  it('uses a positive cached result before Wikidata', async () => {
    const { resolve, wikidata, get } = setup();
    get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(entry);
    expect(await resolve()).toMatchObject({ kind: 'direct', provider: 'wikidata', cached: true });
    expect(wikidata).not.toHaveBeenCalled();
  });

  it('stores a positive Wikidata mapping', async () => {
    const { resolve, wikidata, put } = setup();
    expect(await resolve()).toMatchObject({ kind: 'direct', provider: 'wikidata', cached: false });
    expect(wikidata).toHaveBeenCalledWith(film.csfdId);
    expect(put).toHaveBeenCalledWith(film.csfdId, 'wikidata', slug);
  });

  it('restricts wikidata_only to Wikidata provenance', async () => {
    const { resolve, get, wikidata } = setup({ mode: 'wikidata_only' });
    get.mockResolvedValueOnce(entry);
    expect(await resolve(csfd)).toMatchObject({ kind: 'direct', provider: 'wikidata', cached: true });
    expect(wikidata).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledExactlyOnceWith(film.csfdId, 'wikidata');
  });

  it('uses the network in wikidata_only even with a live ČSFD IMDb link', async () => {
    const { resolve, wikidata } = setup({ mode: 'wikidata_only' });
    expect(await resolve(csfd)).toMatchObject({ kind: 'direct', provider: 'wikidata', cached: false });
    expect(wikidata).toHaveBeenCalledOnce();
  });

  it('restricts csfd_only to the current DOM', async () => {
    const { resolve, get, wikidata } = setup({ mode: 'csfd_only' });
    expect(await resolve()).toMatchObject({ kind: 'search', reason: 'not_found' });
    expect(get).not.toHaveBeenCalled();
    expect(wikidata).not.toHaveBeenCalled();
  });

  it('disables every cache operation when switched off', async () => {
    const { resolve, get, put } = setup({ cacheEnabled: false });
    expect(await resolve()).toMatchObject({ kind: 'direct', cached: false });
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('searches with no cache or fetch in search_only applications', async () => {
    const { resolve, get, put, wikidata } = setup({ mode: 'search_only', fallbackToSearch: false });
    expect(await resolve(csfd)).toEqual({ kind: 'search', url: 'https://letterboxd.com/search/films/P%C5%99epaden%C3%AD%20vlaku%201903/' });
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(wikidata).not.toHaveBeenCalled();
  });

  it.each(['not_found', 'conflict', 'timeout', 'rate_limited', 'unavailable'] as const)(
    'handles %s with both fallback settings',
    async (kind) => {
      for (const fallbackToSearch of [true, false]) {
        const wikidata = vi.fn(async () => ({ kind }));
        const { put, get } = setup();
        expect(await resolveFilm(film, { ...DEFAULT_SETTINGS, fallbackToSearch }, { wikidata, cache: { put, get } }))
          .toMatchObject({ kind: fallbackToSearch ? 'search' : 'error', reason: kind });
        expect(put).not.toHaveBeenCalled();
      }
    },
  );

  it('reports a missing title when no direct match or search is available', async () => {
    const wikidata = vi.fn(async () => notFound);
    expect(await resolveFilm({ ...film, title: undefined }, DEFAULT_SETTINGS, { wikidata }))
      .toEqual({ kind: 'error', reason: 'missing_title' });
  });
});

describe('Letterboxd destinations', () => {
  it('prioritizes an explicit slug over IMDb and TMDB', () => {
    expect(directUrl({ ...slug, imdbId: csfd.imdbId, tmdbId: '5698' }))
      .toBe('https://letterboxd.com/film/the-great-train-robbery/');
    expect(directUrl({ imdbId: csfd.imdbId, tmdbId: '5698' }))
      .toBe('https://letterboxd.com/imdb/tt0000439');
    expect(directUrl({ tmdbId: '5698' })).toBe('https://letterboxd.com/tmdb/5698');
    expect(directUrl({ letterboxdSlug: '../../evil', imdbId: 'tt1234/evil', tmdbId: '123?evil' })).toBeUndefined();
  });

  it('encodes the title as a single path segment', () => {
    expect(searchUrl({ ...film, originalTitle: 'Čáp / A&B?#' }))
      .toBe('https://letterboxd.com/search/films/%C4%8C%C3%A1p%20%2F%20A%26B%3F%23%201903/');
    expect(searchUrl({ ...film, title: '..', year: undefined })).toBeUndefined();
  });
});
