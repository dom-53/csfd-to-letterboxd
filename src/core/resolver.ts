import { directUrl, searchUrl } from './letterboxd';
import { lookupCsfd } from './providers/csfd';
import type { Film, LookupFailure, LookupResult, MappingCache, Provider, Resolution, Settings } from './types';

interface Dependencies {
  wikidata: (csfdId: string) => Promise<LookupResult>;
  cache?: MappingCache;
}

export function resolveSearch(film: Film, reason?: LookupFailure): Resolution {
  const url = searchUrl(film);
  return url ? { kind: 'search', url, reason } : { kind: 'error', reason: 'missing_title' };
}

export async function resolveFilm(
  film: Film,
  settings: Readonly<Settings>,
  dependencies: Dependencies,
): Promise<Resolution> {
  const { mode } = settings;
  if (mode === 'search_only') return resolveSearch(film);
  const cache = settings.cacheEnabled ? dependencies.cache : undefined;
  const failure = (reason: LookupFailure): Resolution => settings.fallbackToSearch
    ? resolveSearch(film, reason)
    : { kind: 'error', reason };

  async function accept(result: LookupResult, provider: Provider): Promise<Resolution> {
    if (result.kind !== 'match') return failure(result.kind);
    const url = directUrl(result.ids);
    if (!url) return failure('not_found');
    await cache?.put(film.csfdId, provider, result.ids).catch(() => undefined);
    return { kind: 'direct', url, provider, cached: false };
  }

  if (mode !== 'wikidata_only') {
    const csfd = lookupCsfd(film);
    if (csfd.kind === 'match' || mode === 'csfd_only') return accept(csfd, 'csfd');
  }

  const providers: Provider[] = mode === 'auto' ? ['csfd', 'wikidata'] : ['wikidata'];
  for (const provider of providers) {
    const cached = await cache?.get(film.csfdId, provider).catch(() => undefined);
    const url = cached && directUrl(cached.ids);
    if (url) return { kind: 'direct', url, provider, cached: true };
  }

  const result = await dependencies.wikidata(film.csfdId);
  return accept(result, 'wikidata');
}
