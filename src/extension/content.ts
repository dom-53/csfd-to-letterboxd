import { csfdIdFromUrl } from '../core/csfd';
import { readCsfdDocument } from '../core/csfd-dom';
import { isRecord } from '../core/validation';
import { mountFilmActions } from './content-ui';
import { PAGE_STATUS, RESOLVE } from './messages';
import { DEFAULT_THEME, SETTINGS_KEY, parseSettings, readSettings } from './settings';
import type { Theme } from './settings';

const pageUrl = () => location.href;

if (csfdIdFromUrl(pageUrl())) {
  let theme: Theme | undefined;
  const mount = () => {
    if (!theme) return;
    mountFilmActions(document, pageUrl, {
      request: (film) => chrome.runtime.sendMessage({ action: RESOLVE, film }),
      message: (key) => chrome.i18n.getMessage(key),
    }, theme);
  };

  function applyTheme(next: Theme) {
    if (theme === next) return;
    theme = next;
    mount();
  }

  chrome.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !isRecord(message) || message.action !== PAGE_STATUS) return false;
    respond({ csfdId: readCsfdDocument(document, pageUrl())?.csfdId ?? null });
    return false;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    const update = changes[SETTINGS_KEY];
    if (area === 'local' && update) applyTheme(parseSettings(update.newValue).theme);
  });
  void readSettings().then(
    (settings) => applyTheme(theme ?? settings.theme),
    () => applyTheme(theme ?? DEFAULT_THEME),
  );

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      mount();
    });
  };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  const schedulePageTheme = () => { if (theme === 'auto') schedule(); };
  const appearance = new MutationObserver(schedulePageTheme);
  const rootAttributes = { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] };
  appearance.observe(document.documentElement, rootAttributes);
  appearance.observe(document.body, rootAttributes);
  appearance.observe(document.head, { childList: true, subtree: true });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedulePageTheme);
  addEventListener('popstate', mount);
}
