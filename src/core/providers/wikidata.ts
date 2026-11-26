import { version } from '../../../package.json';
import type { Identifiers, LookupResult } from '../types';
import { isCsfdId, isRecord, validIdentifiers } from '../validation';

export const WIKIDATA_ENDPOINT = 'https://query-next.wikidata.org/sparql';
const CLIENT = `csfd-to-letterboxd/${version}`;
const TIMEOUT_MS = 5_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export function wikidataUrl(csfdId: string): URL {
  if (!isCsfdId(csfdId)) throw new TypeError('Invalid ČSFD ID');
  const url = new URL(WIKIDATA_ENDPOINT);
  url.searchParams.set('query', `PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT DISTINCT ?film ?imdb ?tmdb ?letterboxd WHERE {
  ?film wdt:P2529 "${csfdId}" .
  OPTIONAL { ?film wdt:P345 ?imdb . }
  OPTIONAL { ?film wdt:P4947 ?tmdb . }
  OPTIONAL { ?film wdt:P6127 ?letterboxd . }
}`);
  return url;
}

function binding(value: unknown): string | undefined {
  return isRecord(value) && typeof value.value === 'string' ? value.value : undefined;
}

const idFields = ['letterboxdSlug', 'imdbId', 'tmdbId'] as const;

export function parseWikidata(value: unknown): LookupResult {
  if (!isRecord(value) || !isRecord(value.results) || !Array.isArray(value.results.bindings)) {
    return { kind: 'unavailable' };
  }
  const entities = new Map<string, Identifiers>();
  for (const row of value.results.bindings) {
    if (!isRecord(row)) return { kind: 'unavailable' };
    const entity = binding(row.film);
    const qid = entity && /^https?:\/\/www\.wikidata\.org\/entity\/(Q[1-9][0-9]*)$/.exec(entity)?.[1];
    if (!qid) return { kind: 'unavailable' };
    const ids = validIdentifiers({
      imdbId: binding(row.imdb),
      tmdbId: binding(row.tmdb),
      letterboxdSlug: binding(row.letterboxd),
    });
    const previous = entities.get(qid) ?? {};
    if (idFields.some((key) => previous[key] && ids[key] && previous[key] !== ids[key])) {
      return { kind: 'conflict' };
    }
    entities.set(qid, { ...previous, ...ids });
  }
  if (entities.size > 1) return { kind: 'conflict' };
  const ids = entities.values().next().value;
  return ids && Object.keys(ids).length ? { kind: 'match', ids } : { kind: 'not_found' };
}

interface CooldownStorage {
  get(): Promise<number | undefined>;
  set(until: number): Promise<void>;
}

interface Options {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  cooldown?: CooldownStorage;
}

function retryTime(header: string | null, now: number): number | undefined {
  if (!header) return undefined;
  const parsed = /^[0-9]+$/.test(header) ? now + Number(header) * 1_000 : Date.parse(header);
  return Number.isFinite(parsed) ? Math.max(parsed, now) : undefined;
}

export function createWikidataLookup(options: Options = {}) {
  const http = options.fetch ?? globalThis.fetch.bind(globalThis);
  const now = options.now ?? Date.now;
  let retryAt = 0;
  const pending = new Map<string, Promise<LookupResult>>();

  async function request(csfdId: string): Promise<LookupResult> {
    const stored = await options.cooldown?.get().catch(() => undefined);
    if (stored && Number.isFinite(stored)) retryAt = Math.max(retryAt, stored);
    if (now() < retryAt) return { kind: 'rate_limited' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
    try {
      const response = await http(wikidataUrl(csfdId), {
        method: 'GET',
        headers: {
          Accept: 'application/sparql-results+json',
          'Api-User-Agent': CLIENT,
        },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
        signal: controller.signal,
      });
      if (!response.ok) {
        const limited = response.status === 429;
        const current = now();
        const retry = retryTime(response.headers.get('Retry-After'), current);
        if (limited || (response.status >= 500 && retry !== undefined)) {
          retryAt = Math.max(retryAt, retry ?? current + DEFAULT_COOLDOWN_MS);
          await options.cooldown?.set(retryAt).catch(() => undefined);
        }
        return { kind: limited ? 'rate_limited' : 'unavailable' };
      }
      return parseWikidata(await response.json());
    } catch {
      return { kind: controller.signal.aborted ? 'timeout' : 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  }

  return (csfdId: string): Promise<LookupResult> => {
    if (!isCsfdId(csfdId)) return Promise.resolve({ kind: 'not_found' });
    const existing = pending.get(csfdId);
    if (existing) return existing;
    const lookup = request(csfdId).finally(() => pending.delete(csfdId));
    pending.set(csfdId, lookup);
    return lookup;
  };
}
