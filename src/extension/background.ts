import { createWikidataLookup } from '../core/providers/wikidata';
import { resolveFilm } from '../core/resolver';
import { isRecord } from '../core/validation';
import { createCache } from './cache';
import { CLEAR_CACHE, PAGE_STATUS, RESOLVE, UPDATE_SETTINGS, readFilmRequest, readSettingsPatch } from './messages';
import type { FilmResponse } from './messages';
import { SETTINGS_KEY, readSettings } from './settings';

const cache = createCache(chrome.storage.local);
const RETRY_KEY = 'wikidataRetryAt';
const wikidata = createWikidataLookup({
  cooldown: {
    async get() {
      const stored = (await chrome.storage.session.get(RETRY_KEY))[RETRY_KEY];
      return typeof stored === 'number' ? stored : undefined;
    },
    set: (until) => chrome.storage.session.set({ [RETRY_KEY]: until }),
  },
});

let cacheGeneration = 0;
let settingsWrites = Promise.resolve();
const pending = new Set<string>();

async function openFilm(request: NonNullable<ReturnType<typeof readFilmRequest>>): Promise<FilmResponse> {
  const { film, tabId, documentId } = request;
  const generation = cacheGeneration;
  const settings = await readSettings();
  const result = await resolveFilm(film, settings, {
    wikidata,
    cache: {
      get: cache.get,
      async put(csfdId, provider, ids) {
        const current = await readSettings();
        if (current.cacheEnabled && cacheGeneration === generation) {
          await cache.put(csfdId, provider, ids);
        }
      },
    },
  });
  if (result.kind === 'error') return result;

  try {
    const status: unknown = await chrome.tabs.sendMessage(
      tabId, { action: PAGE_STATUS }, documentId ? { documentId } : { frameId: 0 },
    );
    if (!isRecord(status) || status.csfdId !== film.csfdId) return { kind: 'error', reason: 'navigation_failed' };
    if (settings.openInNewTab) {
      await chrome.tabs.create({ url: result.url, openerTabId: tabId });
    } else {
      await chrome.tabs.update(tabId, { url: result.url });
    }
    return result;
  } catch {
    return { kind: 'error', reason: 'navigation_failed' };
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isRecord(message)) return false;
  const { action } = message;
  if (action === RESOLVE) {
    const request = readFilmRequest(message, sender, chrome.runtime.id);
    if (!request) {
      sendResponse({ kind: 'error', reason: 'invalid_request' } satisfies FilmResponse);
      return false;
    }
    const key = request.documentId ?? String(request.tabId);
    if (pending.has(key)) {
      sendResponse({ kind: 'error', reason: 'invalid_request' } satisfies FilmResponse);
      return false;
    }
    pending.add(key);
    void openFilm(request)
      .then(sendResponse, () => sendResponse({ kind: 'error', reason: 'unavailable' } satisfies FilmResponse))
      .finally(() => pending.delete(key));
    return true;
  }

  const fromSettings = sender.id === chrome.runtime.id &&
    (sender.url === chrome.runtime.getURL('options.html') || sender.url === chrome.runtime.getURL('popup.html'));
  if (!fromSettings) return false;
  if (action === CLEAR_CACHE) {
    cacheGeneration += 1;
    void cache.clear().then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  if (action === UPDATE_SETTINGS) {
    const patch = readSettingsPatch(message.patch);
    if (!patch) return false;
    const update = settingsWrites.then(async () => {
      await chrome.storage.local.set({ [SETTINGS_KEY]: { ...await readSettings(), ...patch } });
    });
    settingsWrites = update.catch(() => undefined);
    void update.then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }
  return false;
});
