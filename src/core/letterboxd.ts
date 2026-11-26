import type { Film, Identifiers } from './types';
import { textValue, validIdentifiers, validYear } from './validation';

const LETTERBOXD = 'https://letterboxd.com';

export function directUrl(value: Identifiers): string | undefined {
  const ids = validIdentifiers(value);
  if (ids.letterboxdSlug) return `${LETTERBOXD}/film/${ids.letterboxdSlug}/`;
  if (ids.imdbId) return `${LETTERBOXD}/imdb/${ids.imdbId}`;
  if (ids.tmdbId) return `${LETTERBOXD}/tmdb/${ids.tmdbId}`;
  return undefined;
}

export function searchUrl(film: Film): string | undefined {
  const title = textValue(film.originalTitle) ?? textValue(film.title);
  if (!title) return undefined;
  const query = validYear(film.year) ? `${title} ${film.year}` : title;
  if (query === '.' || query === '..') return undefined;
  return `${LETTERBOXD}/search/films/${encodeURIComponent(query.toWellFormed())}/`;
}
