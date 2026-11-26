import { csfdIdFromUrl } from '../core/csfd';
import type { Film, Resolution } from '../core/types';
import { isRecord, readFilm } from '../core/validation';
import { isMode, isTheme } from './settings';
import type { ExtensionSettings } from './settings';

export const PAGE_STATUS = 'csfd:status';
export const RESOLVE = 'csfd:resolve';
export const UPDATE_SETTINGS = 'settings:update';
export const CLEAR_CACHE = 'cache:clear';

export type FilmResponse = Resolution | { kind: 'error'; reason: 'navigation_failed' | 'invalid_request' };

export function readFilmRequest(
  value: unknown,
  sender: chrome.runtime.MessageSender,
  extensionId: string,
): { film: Film; tabId: number; documentId?: string } | undefined {
  if (!isRecord(value) || value.action !== RESOLVE ||
      sender.id !== extensionId || sender.frameId !== 0 || typeof sender.tab?.id !== 'number' ||
      sender.tab.id < 0 || !sender.url) return undefined;
  const film = readFilm(value.film);
  if (!film || film.csfdId !== csfdIdFromUrl(sender.url)) return undefined;
  return { film, tabId: sender.tab.id, documentId: sender.documentId };
}

export function readSettingsPatch(value: unknown): Partial<ExtensionSettings> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length !== 1) return undefined;
  const [name, setting] = entries[0] ?? [];
  if (name === 'mode' && isMode(setting)) return { mode: setting };
  if (name === 'theme' && isTheme(setting)) return { theme: setting };
  if ((name === 'fallbackToSearch' || name === 'cacheEnabled' || name === 'openInNewTab') &&
      typeof setting === 'boolean') return { [name]: setting };
  return undefined;
}
