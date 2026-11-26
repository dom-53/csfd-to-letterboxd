import type { Film, LookupResult } from '../types';
import { isImdbId } from '../validation';

export function lookupCsfd(film: Film): LookupResult {
  return isImdbId(film.imdbId)
    ? { kind: 'match', ids: { imdbId: film.imdbId } }
    : { kind: 'not_found' };
}
