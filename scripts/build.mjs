import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import { build } from 'vite';
import { createIcon } from './icons.mjs';

const local = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

function bundle(entry, file, format, options) {
  return build({
    configFile: false,
    publicDir: false,
    build: {
      target: 'chrome126',
      minify: true,
      lib: { entry: local(entry), name: 'CsfdToLetterboxd', formats: [format], fileName: () => file },
      ...options,
    },
  });
}

async function extension() {
  const dist = 'dist/extension';
  const manifest = JSON.parse(await readFile(local('src/extension/manifest.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(local('package.json'), 'utf8'));
  if (manifest.version !== pkg.version) throw new Error('Manifest and package versions must match');

  await build({
    configFile: false,
    publicDir: false,
    root: local('src/extension'),
    base: './',
    build: {
      outDir: local(dist),
      emptyOutDir: true,
      target: 'chrome126',
      modulePreload: false,
      rolldownOptions: { input: [local('src/extension/popup.html'), local('src/extension/options.html')] },
    },
  });
  const options = { outDir: local(dist), emptyOutDir: false };
  await bundle('src/extension/content.ts', 'content.js', 'iife', options);
  await bundle('src/extension/background.ts', 'background.js', 'es', options);

  await mkdir(local(`${dist}/icons`), { recursive: true });
  await Promise.all([
    cp(local('src/extension/manifest.json'), local(`${dist}/manifest.json`)),
    cp(local('LICENSE'), local(`${dist}/LICENSE`)),
    cp(local('src/extension/content.css'), local(`${dist}/content.css`)),
    cp(local('src/extension/_locales'), local(`${dist}/_locales`), { recursive: true }),
    ...[16, 32, 48, 128].map((size) => writeFile(local(`${dist}/icons/${size}.png`), createIcon(size))),
  ]);
}

async function bookmarklet() {
  const result = await bundle('src/bookmarklet/index.ts', 'bookmarklet.js', 'iife', { write: false });
  const builds = Array.isArray(result) ? result : [result];
  const output = builds.flatMap((item) => item.output);
  if (output.length !== 1 || output[0]?.type !== 'chunk' || output[0].imports.length || output[0].dynamicImports.length) {
    throw new Error('The bookmarklet must be one self-contained bundle');
  }
  const license = (await readFile(local('LICENSE'), 'utf8')).trimEnd().replaceAll('*/', '* /');
  const code = `/*\n${license}\n*/\n${output[0].code}\nvoid 0;`;
  new Script(code);
  await mkdir(local('dist/bookmarklet'), { recursive: true });
  await writeFile(local('dist/bookmarklet/bookmarklet.txt'), `javascript:${encodeURIComponent(code)}\n`);
}

switch (process.argv[2]) {
  case 'extension':
    await extension();
    break;
  case 'bookmarklet':
    await bookmarklet();
    break;
  case 'site':
    await bookmarklet();
    await build({ configFile: local('vite.site.mjs') });
    await cp(local('LICENSE'), local('dist/site/LICENSE'));
    break;
  default:
    throw new Error('Choose extension, bookmarklet or site');
}
