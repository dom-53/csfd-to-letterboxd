import bookmarklet from '../../dist/bookmarklet/bookmarklet.txt?raw';

const link = document.querySelector<HTMLAnchorElement>('#bookmarklet-link');
const details = document.querySelector<HTMLDetailsElement>('#bookmarklet-code');
const code = document.querySelector<HTMLTextAreaElement>('#code');
const copy = document.querySelector<HTMLButtonElement>('#copy');
const status = document.getElementById('copy-status');

if (link && details && code && copy && status) {
  const bookmarkUrl = bookmarklet.trim();
  link.href = bookmarkUrl;
  code.value = bookmarkUrl;
  copy.disabled = false;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    details.open = true;
    details.querySelector('summary')?.focus();
  });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(bookmarkUrl);
      status.textContent = 'Kód byl zkopírován.';
    } catch {
      code.focus();
      code.select();
      status.textContent = 'Kód je označený. Zkopírujte ho klávesovou zkratkou.';
    }
  });
}

for (const [name, value] of Object.entries({
  project: import.meta.env.VITE_PROJECT_URL,
  store: import.meta.env.VITE_CHROME_WEB_STORE_URL,
})) {
  if (typeof value !== 'string') continue;
  const url = URL.parse(value);
  const anchor = document.querySelector<HTMLAnchorElement>(`[data-build-link="${name}"]`);
  if (anchor && url?.protocol === 'https:' && !url.username && !url.password) {
    anchor.href = url.href;
  }
}
