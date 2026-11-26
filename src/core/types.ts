export const MODES = ['auto', 'csfd_only', 'wikidata_only', 'search_only'] as const;
export type Mode = (typeof MODES)[number];
export type Provider = 'csfd' | 'wikidata';

export interface Settings {
  mode: Mode;
  fallbackToSearch: boolean;
  cacheEnabled: boolean;
  openInNewTab: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  mode: 'auto',
  fallbackToSearch: true,
  cacheEnabled: true,
  openInNewTab: true,
};

export interface Film {
  type: 'Movie';
  csfdId: string;
  title?: string;
  originalTitle?: string;
  year?: number;
  directors: string[];
  imdbId?: string;
}

export interface Identifiers {
  imdbId?: string;
  tmdbId?: string;
  letterboxdSlug?: string;
}

export type LookupFailure = 'not_found' | 'conflict' | 'unavailable' | 'timeout' | 'rate_limited';
export type LookupResult =
  | { kind: 'match'; ids: Identifiers }
  | { kind: LookupFailure };

export interface CacheEntry {
  version: 1;
  csfdId: string;
  provider: Provider;
  ids: Identifiers;
  obtainedAt: number;
}

export interface MappingCache {
  get(csfdId: string, provider: Provider): Promise<CacheEntry | undefined>;
  put(csfdId: string, provider: Provider, ids: Identifiers): Promise<void>;
}

export type Resolution =
  | { kind: 'direct'; url: string; provider: Provider; cached: boolean }
  | { kind: 'search'; url: string; reason?: LookupFailure }
  | { kind: 'error'; reason: LookupFailure | 'missing_title' };
