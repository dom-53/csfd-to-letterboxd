import { FILM_HEADER, readCsfdDocument } from '../core/csfd-dom';
import type { Film } from '../core/types';
import type { FilmResponse } from './messages';
import { DEFAULT_THEME } from './settings';
import type { Theme } from './settings';

const CONTROL_ID = 'csfd-to-letterboxd-controls';

interface Actions {
  request(film: Film): Promise<FilmResponse>;
  message(key: string): string;
}

const RGB_BACKGROUND = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/;

function themeFromPage(header: Element): Theme {
  if (header.closest('.dark-mode')) return 'dark';
  const view = header.ownerDocument.defaultView;
  if (!view) return 'auto';

  for (let element: Element | null = header; element; element = element.parentElement) {
    const color = RGB_BACKGROUND.exec(view.getComputedStyle(element).backgroundColor);
    if (!color || (color[4] !== undefined && Number(color[4]) < 0.9)) continue;
    const brightness = 0.299 * Number(color[1]) + 0.587 * Number(color[2]) + 0.114 * Number(color[3]);
    return brightness < 128 ? 'dark' : 'light';
  }
  return 'auto';
}

export function mountFilmActions(
  document: Document,
  pageUrl: () => string,
  actions: Actions,
  theme: Theme = DEFAULT_THEME,
): void {
  const film = readCsfdDocument(document, pageUrl());
  const header = document.querySelector(FILM_HEADER);
  const existing = document.getElementById(CONTROL_ID);
  if (!film || !header) {
    existing?.remove();
    return;
  }
  const renderedTheme = theme === 'auto' ? themeFromPage(header) : theme;
  if (existing?.parentElement === header && existing.dataset.film === film.csfdId) {
    if (existing.dataset.theme !== renderedTheme) existing.dataset.theme = renderedTheme;
    return;
  }
  existing?.remove();

  const controls = document.createElement('div');
  controls.id = CONTROL_ID;
  controls.dataset.film = film.csfdId;
  controls.dataset.theme = renderedTheme;
  const primary = document.createElement('button');
  primary.type = 'button';
  primary.className = 'csfd-to-letterboxd-primary';
  primary.textContent = 'Letterboxd';
  primary.title = actions.message('openFilm');
  primary.setAttribute('aria-label', primary.title);
  const external = document.createElement('span');
  external.className = 'csfd-to-letterboxd-external';
  external.setAttribute('aria-hidden', 'true');
  external.textContent = '↗︎';
  primary.append(external);

  const status = document.createElement('span');
  status.className = 'csfd-to-letterboxd-status';
  status.setAttribute('role', 'status');
  controls.append(primary, status);
  header.append(controls);

  async function run() {
    if (primary.disabled) return;
    const current = readCsfdDocument(document, pageUrl());
    if (!current || current.csfdId !== film?.csfdId) {
      status.textContent = actions.message('unsupported');
      return;
    }
    primary.disabled = true;
    status.textContent = '';
    try {
      const result = await actions.request(current);
      if (result.kind === 'error') status.textContent = actions.message(`error_${result.reason}`);
    } catch {
      status.textContent = actions.message('error_unavailable');
    } finally {
      primary.disabled = false;
    }
  }

  primary.addEventListener('click', () => void run());
}
