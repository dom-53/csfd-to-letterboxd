import { isRecord } from '../core/validation';
import { CLEAR_CACHE, PAGE_STATUS, UPDATE_SETTINGS } from './messages';
import { SETTINGS_KEY, isMode, isTheme, parseSettings, readSettings } from './settings';
import type { ExtensionSettings } from './settings';

const msg = (key: string) => chrome.i18n.getMessage(key);
document.title = msg('extensionName');
for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  element.textContent = msg(element.dataset.i18n ?? '');
}

const status = document.getElementById('settings-status');
const mode = document.querySelector<HTMLSelectElement>('#mode');
const theme = document.querySelector<HTMLSelectElement>('#theme');
const toggleKeys = ['fallbackToSearch', 'cacheEnabled', 'openInNewTab'] as const;
let settingsRendered = false;
function render(settings: ExtensionSettings) {
  settingsRendered = true;
  document.documentElement.dataset.theme = settings.theme;
  if (mode) {
    mode.value = settings.mode;
    mode.disabled = false;
  }
  if (theme) {
    theme.value = settings.theme;
    theme.disabled = false;
  }
  for (const key of toggleKeys) {
    const input = document.querySelector<HTMLInputElement>(`input[name="${key}"]`);
    if (!input) continue;
    input.checked = settings[key];
    input.disabled = false;
  }
}

async function write(message: object, success: string) {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message);
    if (!isRecord(response) || response.ok !== true) throw new Error('Write failed');
    if (status) status.textContent = msg(success);
  } catch {
    if (status) status.textContent = msg('settingsError');
    await readSettings().then(render, () => undefined);
  }
}

mode?.addEventListener('change', () => {
  if (isMode(mode.value)) void write({ action: UPDATE_SETTINGS, patch: { mode: mode.value } }, 'settingsSaved');
});
theme?.addEventListener('change', () => {
  if (isTheme(theme.value)) void write({ action: UPDATE_SETTINGS, patch: { theme: theme.value } }, 'settingsSaved');
});
for (const key of toggleKeys) {
  const input = document.querySelector<HTMLInputElement>(`input[name="${key}"]`);
  input?.addEventListener('change', () => {
    void write({ action: UPDATE_SETTINGS, patch: { [key]: input.checked } }, 'settingsSaved');
  });
}
document.getElementById('clear-cache')?.addEventListener('click', () => {
  void write({ action: CLEAR_CACHE }, 'cacheCleared');
});
document.getElementById('open-options')?.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
  const update = changes[SETTINGS_KEY];
  if (area === 'local' && update) render(parseSettings(update.newValue));
});

void readSettings().then((settings) => {
  if (!settingsRendered) render(settings);
}, () => {
  if (!settingsRendered && status) status.textContent = msg('settingsLoadError');
});

async function popupStatus(element: HTMLElement) {
  let supported = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id !== undefined) {
      const result: unknown = await chrome.tabs.sendMessage(tab.id, { action: PAGE_STATUS }, { frameId: 0 });
      supported = isRecord(result) && typeof result.csfdId === 'string';
    }
  } catch {
    // Tabs outside the content script match have no receiver.
  }
  element.textContent = msg(supported ? 'supported' : 'unsupported');
}

const pageStatus = document.getElementById('page-status');
if (pageStatus) void popupStatus(pageStatus);
