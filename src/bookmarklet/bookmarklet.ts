import { readCsfdDocument } from '../core/csfd-dom';
import { createWikidataLookup } from '../core/providers/wikidata';
import { resolveFilm } from '../core/resolver';
import { DEFAULT_SETTINGS } from '../core/types';
import type { LookupResult } from '../core/types';

const messages = {
  unsupported: 'Nejdřív otevřete stránku filmu na ČSFD.',
  missing_title: 'Na ČSFD chybí název filmu pro vyhledávání.',
  error: 'Letterboxd se nepodařilo otevřít.',
};

interface Context {
  document: Document;
  url: string;
  navigate(url: string): void;
  notify(message: string): void;
  wikidata?: (csfdId: string) => Promise<LookupResult>;
}

export async function runBookmarklet(context: Context): Promise<void> {
  try {
    const film = readCsfdDocument(context.document, context.url);
    if (!film) {
      context.notify(messages.unsupported);
      return;
    }
    const result = await resolveFilm(film, { ...DEFAULT_SETTINGS, cacheEnabled: false, openInNewTab: false }, {
      wikidata: context.wikidata ?? createWikidataLookup(),
    });
    if (result.kind === 'error') {
      context.notify(result.reason === 'missing_title' ? messages.missing_title : messages.error);
      return;
    }
    context.navigate(result.url);
  } catch {
    context.notify(messages.error);
  }
}
