// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import trainRobbery from '../fixtures/great-train-robbery.html?raw';
import { csfdIdFromUrl, parseFilmJsonLd } from '../src/core/csfd';
import { imdbIdFromHref, readCsfdDocument } from '../src/core/csfd-dom';
import { createWikidataLookup } from '../src/core/providers/wikidata';
import { runBookmarklet } from '../src/bookmarklet/bookmarklet';
import { mountFilmActions } from '../src/extension/content-ui';

const page = 'https://www.csfd.cz/film/167098-velka-zeleznicni-loupez/prehled/';
const documentFrom = (html = trainRobbery) => new DOMParser().parseFromString(html, 'text/html');

describe('ČSFD page parsing', () => {
  it('reads JSON-LD and finds the original title after a Czech alternate title', () => {
    expect(readCsfdDocument(documentFrom(), page)).toEqual({
      type: 'Movie', csfdId: '167098', title: 'Přepadení vlaku', originalTitle: 'The Great Train Robbery',
      year: 1903, directors: ['Edwin S. Porter'], imdbId: undefined,
    });
  });

  it('chooses the work that references the current page', () => {
    const ld = JSON.stringify([
      { '@type': 'Movie', name: 'Other movie', url: '/film/12-other/' },
      { '@type': 'https://schema.org/Movie', name: 'This movie', url: page, datePublished: '2026-04-02' },
      { '@type': 'TVSeries', name: 'Other series' },
    ]);
    expect(parseFilmJsonLd(page, [ld])).toMatchObject({ title: 'This movie', year: 2026 });
    expect(parseFilmJsonLd(page, ['[]', '{bad}', '{}'])).toBeUndefined();
  });

  it.each(['TVSeries', 'TVSeason', 'TVEpisode', 'Episode', 'VideoObject'])('rejects %s', (type) => {
    expect(parseFilmJsonLd(page, [JSON.stringify({ '@type': type })])).toBeUndefined();
  });

  it('rejects ambiguous film records', () => {
    expect(parseFilmJsonLd(page, ['{"@type":["Movie","TVEpisode"]}'])).toBeUndefined();
    expect(parseFilmJsonLd(page, ['[{"@type":"Movie","name":"A"},{"@type":"Movie","name":"B"}]'])).toBeUndefined();
  });

  it('keeps the primary title when there are only hidden alternate names', () => {
    const document = documentFrom();
    document.querySelector('.film-names li')?.remove();
    expect(readCsfdDocument(document, page)).toMatchObject({ title: 'Přepadení vlaku', originalTitle: undefined });
  });

  it('prefers the visible original title once it is the first title', () => {
    const document = documentFrom();
    document.querySelector('.film-names li')?.remove();
    document.querySelector('.film-names li')?.classList.remove('more-names', 'hidden');
    expect(readCsfdDocument(document, page)?.originalTitle).toBe('The Great Train Robbery');
  });

  it('keeps the main title if the next alternate name has no matching production country', () => {
    const document = documentFrom(trainRobbery.replace('class="origin">USA', 'class="origin">Francie'));
    expect(readCsfdDocument(document, page)).toMatchObject({ title: 'Přepadení vlaku', originalTitle: undefined });
  });

  it('reads a direct IMDb link only in the film link section', () => {
    const document = documentFrom();
    expect(readCsfdDocument(document, page)?.imdbId).toBeUndefined();
    document.querySelector('.film-info')?.insertAdjacentHTML('beforeend',
      '<section class="film-links"><a href="https://www.imdb.com/title/tt0000439/?x=y">IMDb</a></section>');
    expect(readCsfdDocument(document, page)?.imdbId).toBe('tt0000439');
    document.querySelector('.film-links')?.insertAdjacentHTML('beforeend',
      '<a href="https://www.imdb.com/title/tt0000417/">Another IMDb title</a>');
    expect(readCsfdDocument(document, page)?.imdbId).toBeUndefined();
  });

  it.each([
    'https://www.csfd.cz.example/film/167098-velka-zeleznicni-loupez/',
    'http://www.csfd.cz/film/167098-velka-zeleznicni-loupez/',
    'https://www.csfd.cz/film/000-trainRobbery/',
    'https://www.csfd.cz/film/167098/',
    'https://www.csfd.cz/tvurce/167098-velka-zeleznicni-loupez/',
  ])('rejects %s', (url) => {
    expect(csfdIdFromUrl(url)).toBeUndefined();
  });

  it.each([
    'https://fake.imdb.com/title/tt0000439/',
    'https://www.imdb.com.example/title/tt0000439/',
    'https://www.imdb.com:11443/title/tt0000439/',
    'https://user@www.imdb.com/title/tt0000439/',
    'http://www.imdb.com/title/tt0000439/',
    'https://www.imdb.com/name/tt0000439/',
    'https://www.csfd.cz/redirect/?href=https://www.imdb.com/title/tt0000439/',
  ])('rejects an invalid IMDb href', (href) => {
    expect(imdbIdFromHref(href, page)).toBeUndefined();
  });
});

describe('browser entry points', () => {
  it('mounts once, blocks duplicate clicks and allows retry', async () => {
    const document = documentFrom();
    const request = vi.fn(async () => ({ kind: 'error', reason: 'not_found' }) as const);
    const actions = { request, message: (key: string) => key };
    mountFilmActions(document, () => page, actions);
    mountFilmActions(document, () => page, actions);
    expect(document.querySelectorAll('#csfd-to-letterboxd-controls')).toHaveLength(1);
    const button = document.querySelector<HTMLButtonElement>('.csfd-to-letterboxd-primary');
    button?.click();
    button?.click();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ csfdId: '167098' }));
    await vi.waitFor(() => expect(button?.disabled).toBe(false));
    expect(document.querySelector('[role=status]')?.textContent).toBe('error_not_found');
    button?.click();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('updates the existing button theme and detects the ČSFD dark theme in automatic mode', () => {
    const document = documentFrom();
    const actions = { request: vi.fn(), message: (key: string) => key };
    document.body.classList.add('dark-mode');
    mountFilmActions(document, () => page, actions);
    const controls = document.getElementById('csfd-to-letterboxd-controls');
    expect(controls?.dataset.theme).toBe('dark');
    const button = controls?.querySelector('button');
    mountFilmActions(document, () => page, actions, 'light');
    expect(controls?.dataset.theme).toBe('light');
    expect(controls?.querySelector('button')).toBe(button);
  });

  it.each([
    { kind: 'direct', provider: 'wikidata', cached: false, url: 'https://letterboxd.com/film/the-great-train-robbery/' },
    { kind: 'search', url: 'https://letterboxd.com/search/films/The%20Great%20Train%20Robbery%201903/' },
  ] as const)('silently opens a $kind result from the only button', async (result) => {
    const document = documentFrom();
    const request = vi.fn(async () => result);
    mountFilmActions(document, () => page, { request, message: (key) => key });
    const buttons = document.querySelectorAll<HTMLButtonElement>('#csfd-to-letterboxd-controls button');
    expect(buttons).toHaveLength(1);
    const button = buttons[0]!;
    const status = document.querySelector('[role=status]');
    button.click();
    expect(button.disabled).toBe(true);
    expect(status?.textContent).toBe('');
    await vi.waitFor(() => expect(button.disabled).toBe(false));
    expect(status?.textContent).toBe('');
  });

  it('finds unsupported pages and never calls the bookmarklet provider', async () => {
    const document = documentFrom(trainRobbery.replace('"Movie"', '"TVSeries"'));
    const wikidata = vi.fn();
    const navigate = vi.fn();
    const notify = vi.fn();
    await runBookmarklet({ document, url: page, navigate, notify, wikidata });
    expect(notify).toHaveBeenCalledWith('Nejdřív otevřete stránku filmu na ČSFD.');
    expect(wikidata).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('falls back when the bookmarklet network request is blocked', async () => {
    const http = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const navigate = vi.fn();
    await runBookmarklet({
      document: documentFrom(), url: page, navigate, notify: vi.fn(),
      wikidata: createWikidataLookup({ fetch: http }),
    });
    expect(http).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('https://letterboxd.com/search/films/The%20Great%20Train%20Robbery%201903/');
  });
});
