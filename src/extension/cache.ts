import { directUrl } from '../core/letterboxd';
import type { CacheEntry, MappingCache, Provider } from '../core/types';
import { isCsfdId, isRecord, validIdentifiers } from '../core/validation';

export const CACHE_KEY = 'mappings';
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const CACHE_LIMIT = 2_000;

export interface CacheStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

function readEntry(value: unknown, now: number): CacheEntry | undefined {
  if (!isRecord(value) || value.version !== 1 || !isCsfdId(value.csfdId) ||
      (value.provider !== 'csfd' && value.provider !== 'wikidata') ||
      typeof value.obtainedAt !== 'number' || !Number.isFinite(value.obtainedAt) ||
      value.obtainedAt > now || now - value.obtainedAt >= CACHE_TTL_MS) return undefined;
  const ids = validIdentifiers(value.ids);
  if (!directUrl(ids)) return undefined;
  return { version: 1, csfdId: value.csfdId, provider: value.provider, obtainedAt: value.obtainedAt, ids };
}

function key(csfdId: string, provider: Provider): string {
  return `${csfdId}:${provider}`;
}

export function createCache(storage: CacheStorage, now = Date.now, limit = CACHE_LIMIT):
  MappingCache & { clear(): Promise<void> } {
  let writes = Promise.resolve();

  async function read() {
    const stored = (await storage.get(CACHE_KEY))[CACHE_KEY];
    return isRecord(stored) ? stored : {};
  }

  function enqueue(action: () => Promise<void>): Promise<void> {
    const result = writes.then(action);
    writes = result.catch(() => undefined);
    return result;
  }

  return {
    async get(csfdId, provider) {
      await writes;
      const entry = readEntry((await read())[key(csfdId, provider)], now());
      return entry?.csfdId === csfdId && entry.provider === provider ? entry : undefined;
    },
    put(csfdId, provider, input) {
      const ids = validIdentifiers(input);
      if (!isCsfdId(csfdId) || !directUrl(ids)) return Promise.resolve();
      return enqueue(async () => {
        const obtainedAt = now();
        const entries = new Map<string, CacheEntry>();
        for (const value of Object.values(await read())) {
          const entry = readEntry(value, obtainedAt);
          if (entry) entries.set(key(entry.csfdId, entry.provider), entry);
        }
        entries.delete(key(csfdId, provider));
        const entry: CacheEntry = { version: 1, csfdId, provider, ids, obtainedAt };
        const newest = [[key(csfdId, provider), entry] as const, ...entries]
          .sort(([, a], [, b]) => b.obtainedAt - a.obtainedAt);
        await storage.set({ [CACHE_KEY]: Object.fromEntries(newest.slice(0, limit)) });
      });
    },
    clear() {
      return enqueue(() => storage.remove(CACHE_KEY));
    },
  };
}
