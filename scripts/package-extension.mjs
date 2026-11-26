import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, zipSync } from 'fflate';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const root = join(dist, 'extension');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return results.flat();
}

const data = Object.fromEntries(await Promise.all((await files(root)).sort().map(async (file) => [
  relative(root, file).split(sep).join('/'),
  await readFile(file),
])));
const zip = zipSync(data, { mtime: new Date(1980, 0, 1) });
const contents = unzipSync(zip);
const manifest = JSON.parse(Buffer.from(contents['manifest.json']).toString('utf8'));
if (manifest.manifest_version !== 3 || manifest.version !== pkg.version) {
  throw new Error('The ZIP must have a valid and version-matched MV3 manifest in its root');
}

const required = [
  'LICENSE',
  manifest.background.service_worker,
  manifest.action.default_popup,
  manifest.options_ui.page,
  ...Object.values(manifest.icons),
  ...Object.values(manifest.action.default_icon),
  ...manifest.content_scripts.flatMap(({ js, css }) => [...js, ...css]),
  `_locales/${manifest.default_locale}/messages.json`,
];
for (const path of required) {
  if (!contents[path]?.length) throw new Error(`Missing extension file: ${path}`);
}
for (const page of [manifest.action.default_popup, manifest.options_ui.page]) {
  const source = Buffer.from(contents[page]).toString('utf8');
  const assets = [...source.matchAll(/(?:src|href)="\.\/([^"]+)"/g)];
  if (!assets.length || assets.some((asset) => !contents[asset[1]]?.length)) {
    throw new Error(`Broken local asset link in ${page}`);
  }
}

await mkdir(dist, { recursive: true });
const path = join(dist, `csfd-to-letterboxd-${pkg.version}.zip`);
await writeFile(path, zip);
console.log(`Verified ${Object.keys(contents).length} files: ${path}`);
