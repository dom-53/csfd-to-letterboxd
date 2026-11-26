import { DEFAULT_SETTINGS, MODES } from '../core/types';
import type { Mode, Settings } from '../core/types';
import { isRecord } from '../core/validation';

export const SETTINGS_KEY = 'settings';
export type Theme = 'auto' | 'light' | 'dark';
export type ExtensionSettings = Settings & { theme: Theme };

export const DEFAULT_THEME: Theme = 'auto';

export function isMode(value: unknown): value is Mode {
  return MODES.some((mode) => mode === value);
}

export function isTheme(value: unknown): value is Theme {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function parseSettings(value: unknown): ExtensionSettings {
  if (!isRecord(value)) return { ...DEFAULT_SETTINGS, theme: DEFAULT_THEME };
  return {
    mode: isMode(value.mode) ? value.mode : DEFAULT_SETTINGS.mode,
    theme: isTheme(value.theme) ? value.theme : DEFAULT_THEME,
    fallbackToSearch: typeof value.fallbackToSearch === 'boolean'
      ? value.fallbackToSearch : DEFAULT_SETTINGS.fallbackToSearch,
    cacheEnabled: typeof value.cacheEnabled === 'boolean' ? value.cacheEnabled : DEFAULT_SETTINGS.cacheEnabled,
    openInNewTab: typeof value.openInNewTab === 'boolean' ? value.openInNewTab : DEFAULT_SETTINGS.openInNewTab,
  };
}

export async function readSettings(): Promise<ExtensionSettings> {
  return parseSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
}
