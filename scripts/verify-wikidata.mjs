import { createServer } from 'vite';

const ids = process.argv.slice(2);
if (!ids.length) ids.push('167098', '47384');
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null, ws: false },
  appType: 'custom',
});
try {
  const { createWikidataLookup } = await server.ssrLoadModule('/src/core/providers/wikidata.ts');
  const lookup = createWikidataLookup({
    fetch: async (...args) => {
      const response = await fetch(...args);
      console.log(`HTTP ${response.status} · ${response.headers.get('content-type')}`);
      return response;
    },
  });
  for (const id of ids) {
    const result = await lookup(id);
    console.log(id, JSON.stringify(result));
    if (result.kind !== 'match') process.exitCode = 1;
  }
} finally {
  await server.close();
}
