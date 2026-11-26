import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/core/types';
import type { Film } from '../src/core/types';
import { CACHE_KEY, CACHE_TTL_MS, createCache } from '../src/extension/cache';
import { RESOLVE, readFilmRequest, readSettingsPatch } from '../src/extension/messages';
import { parseSettings } from '../src/extension/settings';

const film: Film = { type: 'Movie', csfdId: '167098', directors: [], title: 'Přepadení vlaku' };
const sender = { id: 'abc', url: 'https://www.csfd.cz/film/167098-velka-zeleznicni-loupez/prehled/', frameId: 0, tab: { id: 1 } };
const payload = { action: RESOLVE, film };

describe('extension message boundaries', () => {
  it('accepts well-formed film messages from the matching top-level page', () => {
    expect(readFilmRequest(payload, sender as chrome.runtime.MessageSender, 'abc')).toMatchObject({ film, tabId: 1 });
  });

  it.each([
    { ...sender, frameId: 1 },
    { ...sender, id: 'other' },
    { ...sender, url: 'https://www.csfd.cz.example/film/167098-lookalike/' },
    { ...sender, url: 'https://www.csfd.cz/film/123-other/' },
    { ...sender, tab: undefined },
  ])('rejects an invalid sender', (source) => {
    expect(readFilmRequest(payload, source as chrome.runtime.MessageSender, 'abc')).toBeUndefined();
  });

  it('validates data and settings patches', () => {
    const from = sender as chrome.runtime.MessageSender;
    expect(readFilmRequest({ ...payload, film: { ...film, imdbId: 'https://example.org' } }, from, 'abc'))
      .toBeUndefined();
    expect(readFilmRequest({ ...payload, film: { ...film, type: 'TVSeries' } }, from, 'abc')).toBeUndefined();
    expect(readSettingsPatch({ mode: 'wikidata_only' })).toEqual({ mode: 'wikidata_only' });
    expect(readSettingsPatch({ mode: 'invalid' })).toBeUndefined();
    expect(readSettingsPatch({ cacheEnabled: 'false' })).toBeUndefined();
    expect(parseSettings({ mode: 'invalid', cacheEnabled: false })).toEqual({ ...DEFAULT_SETTINGS, cacheEnabled: false, theme: 'auto' });
  });

  it('accepts manual appearance settings and defaults invalid or older settings to automatic', () => {
    expect(readSettingsPatch({ theme: 'dark' })).toEqual({ theme: 'dark' });
    expect(readSettingsPatch({ theme: 'light' })).toEqual({ theme: 'light' });
    expect(readSettingsPatch({ theme: 'auto' })).toEqual({ theme: 'auto' });
    expect(readSettingsPatch({ theme: 'sepia' })).toBeUndefined();
    expect(parseSettings({ theme: 'sepia' }).theme).toBe('auto');
    expect(parseSettings({ mode: 'wikidata_only' }).theme).toBe('auto');
    expect(parseSettings({ theme: 'dark' }).theme).toBe('dark');
  });
});

describe('extension cache', () => {
  function setup(limit = 2) {
    let tick = 100;
    const stored: Record<string, unknown> = {};
    const get = vi.fn(async (key: string) => ({ [key]: structuredClone(stored[key]) }));
    const set = vi.fn(async (items: Record<string, unknown>) => { Object.assign(stored, structuredClone(items)); });
    const remove = vi.fn(async (key: string) => { delete stored[key]; });
    const cache = createCache({ get, set, remove }, () => tick, limit);
    return { cache, stored, advance: (ms: number) => { tick += ms; } };
  }

  it('maintains origin and expiry, clears only the mapping data', async () => {
    const { cache, stored, advance } = setup();
    stored.settings = { mode: 'auto' };
    await cache.put('167098', 'csfd', { imdbId: 'tt0000439' });
    expect(await cache.get('167098', 'wikidata')).toBeUndefined();
    expect(await cache.get('167098', 'csfd')).toMatchObject({ provider: 'csfd', ids: { imdbId: 'tt0000439' } });
    advance(CACHE_TTL_MS);
    expect(await cache.get('167098', 'csfd')).toBeUndefined();
    await cache.clear();
    expect(stored).toEqual({ settings: { mode: 'auto' } });
  });

  it('evicts oldest entries and serializes concurrent writes and clear', async () => {
    const { cache, stored } = setup();
    await Promise.all([
      cache.put('1', 'wikidata', { letterboxdSlug: 'first' }),
      cache.put('2', 'wikidata', { letterboxdSlug: 'second' }),
      cache.put('3', 'wikidata', { letterboxdSlug: 'third' }),
    ]);
    expect(await cache.get('1', 'wikidata')).toBeUndefined();
    expect(await cache.get('2', 'wikidata')).toBeDefined();
    expect(await cache.get('3', 'wikidata')).toBeDefined();
    await Promise.all([cache.put('4', 'wikidata', { letterboxdSlug: 'fourth' }), cache.clear()]);
    expect(stored[CACHE_KEY]).toBeUndefined();
  });
});
