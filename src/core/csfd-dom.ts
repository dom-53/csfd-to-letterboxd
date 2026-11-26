import { parseFilmJsonLd } from './csfd';
import type { Film } from './types';
import { isImdbId, textValue } from './validation';

export const FILM_HEADER = '.movie-profile .film-info > .film-header';
const TITLE_HEADER = `${FILM_HEADER} > .film-header-name`;
const PRIMARY_FOREIGN_TITLE = `${TITLE_HEADER} > .film-names > li:first-child:not(.more-names):not(.hidden)`;
const LOCAL_TITLE_COUNTRIES = new Set(['Česko', 'Československo', 'Slovensko']);
const EXTERNAL_LINKS = '.film-links, .external-links, [data-role="external-links"]';
const FILM_INFO = '.movie-profile .film-info';
const IMDB_HOSTS = new Set(['imdb.com', 'www.imdb.com', 'm.imdb.com']);
const EXCLUDED = 'article, .reviews, .comments, .user-reviews, .film-names';

function originalTitle(document: Document): string | undefined {
  let row = document.querySelector(PRIMARY_FOREIGN_TITLE);
  const flag = row?.querySelector(':scope > img.flag');
  if (!row || !flag) return undefined;

  if (LOCAL_TITLE_COUNTRIES.has(flag.getAttribute('alt') ?? '')) {
    // ČSFD can put a Czech alternate title before the title from the film's country of origin.
    const country = textValue(document.querySelector(FILM_INFO + ' .origin')?.firstChild?.textContent);
    const next = row.nextElementSibling;
    if (!country || LOCAL_TITLE_COUNTRIES.has(country) || !next?.matches('li.more-names') ||
        next.querySelector(':scope > img.flag')?.getAttribute('alt') !== country) return undefined;
    row = next;
  }

  const text = Array.from(row.childNodes)
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? '')
    .join(' ');
  return textValue(text);
}

export function imdbIdFromHref(href: string, pageUrl: string): string | undefined {
  const url = URL.parse(href, pageUrl);
  if (!url || url.protocol !== 'https:' || !IMDB_HOSTS.has(url.hostname) ||
      url.port || url.username || url.password) return undefined;
  const id = /^\/title\/(tt[0-9]+)\/?$/.exec(url.pathname)?.[1];
  return isImdbId(id) ? id : undefined;
}

function findImdbId(document: Document, pageUrl: string): string | undefined {
  const info = document.querySelector(FILM_INFO);
  const ids = new Set<string>();
  for (const section of info?.querySelectorAll(EXTERNAL_LINKS) ?? []) {
    for (const anchor of section.querySelectorAll('a[href]')) {
      const excluded = anchor.closest(EXCLUDED);
      if (excluded && info?.contains(excluded)) continue;
      const id = imdbIdFromHref(anchor.getAttribute('href') ?? '', pageUrl);
      if (id) ids.add(id);
    }
  }
  return ids.size === 1 ? ids.values().next().value : undefined;
}

export function readCsfdDocument(document: Document, pageUrl: string): Film | undefined {
  const scripts = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map((script) => script.textContent ?? '');
  const film = parseFilmJsonLd(pageUrl, scripts);
  if (!film) return undefined;
  return {
    ...film,
    title: film.title ?? textValue(document.querySelector(`${TITLE_HEADER} > h1`)?.textContent),
    originalTitle: originalTitle(document),
    imdbId: findImdbId(document, pageUrl),
  };
}
