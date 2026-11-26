import type { Film, Identifiers } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCsfdId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]{0,15}$/.test(value);
}

export function isImdbId(value: unknown): value is string {
  return typeof value === 'string' && /^tt[0-9]{7,16}$/.test(value);
}

export function textValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 0 && clean.length <= 500 ? clean : undefined;
}

export function validYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1800 && value <= 2199;
}

export function validIdentifiers(value: unknown): Identifiers {
  if (!isRecord(value)) return {};
  const ids: Identifiers = {};
  if (isImdbId(value.imdbId)) ids.imdbId = value.imdbId;
  if (isCsfdId(value.tmdbId)) ids.tmdbId = value.tmdbId;
  if (typeof value.letterboxdSlug === 'string' &&
      /^[a-z0-9][a-z0-9-]{0,199}$/.test(value.letterboxdSlug)) {
    ids.letterboxdSlug = value.letterboxdSlug;
  }
  return ids;
}

export function readFilm(value: unknown): Film | undefined {
  if (!isRecord(value) || value.type !== 'Movie' || !isCsfdId(value.csfdId)) return undefined;
  if (!Array.isArray(value.directors) || value.directors.length > 20) return undefined;
  const { title, originalTitle, year, imdbId } = value;
  const directors = value.directors.map(textValue);
  if (directors.some((name) => name === undefined) ||
      (title !== undefined && textValue(title) === undefined) ||
      (originalTitle !== undefined && textValue(originalTitle) === undefined) ||
      (year !== undefined && !validYear(year)) ||
      (imdbId !== undefined && !isImdbId(imdbId))) return undefined;
  return {
    type: 'Movie',
    csfdId: value.csfdId,
    title: textValue(title),
    originalTitle: textValue(originalTitle),
    year: validYear(year) ? year : undefined,
    directors: directors.filter((name): name is string => name !== undefined),
    imdbId: isImdbId(imdbId) ? imdbId : undefined,
  };
}
