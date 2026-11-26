import type { Film } from './types';
import { isCsfdId, isRecord, textValue, validYear } from './validation';

export function csfdIdFromUrl(input: string): string | undefined {
  const url = URL.parse(input);
  if (!url || url.origin !== 'https://www.csfd.cz' || url.username || url.password) return undefined;
  const id = /^\/film\/([0-9]+)-[^/]+(?:\/|$)/.exec(url.pathname)?.[1];
  return isCsfdId(id) ? id : undefined;
}

const workTypes = new Set([
  'Movie', 'TVSeries', 'TVSeason', 'TVEpisode', 'Series', 'Season', 'Episode',
  'CreativeWorkSeries', 'CreativeWorkSeason',
]);

function workNodes(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 16) return [];
  if (Array.isArray(value)) return value.flatMap((item) => workNodes(item, depth + 1));
  if (!isRecord(value)) return [];
  return [value, ...workNodes(value['@graph'], depth + 1), ...workNodes(value.mainEntity, depth + 1)];
}

function typesOf(node: Record<string, unknown>): string[] {
  const type = node['@type'];
  return (Array.isArray(type) ? type : [type])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/^https?:\/\/schema\.org\//, ''))
    .filter((value) => workTypes.has(value));
}

function referencedIds(node: Record<string, unknown>): string[] {
  const page = node.mainEntityOfPage;
  const candidates = [node.url, node['@id'], isRecord(page) ? page['@id'] : page];
  return candidates.flatMap((value) => {
    if (typeof value !== 'string' || !/^(?:https:\/\/|\/(?!\/))/.test(value)) return [];
    const url = URL.parse(value, 'https://www.csfd.cz');
    const id = url && csfdIdFromUrl(url.href);
    return id ? [id] : [];
  });
}

function yearOf(value: unknown): number | undefined {
  if (validYear(value)) return value;
  if (typeof value !== 'string') return undefined;
  const year = Number(/^([0-9]{4})(?:$|-[0-9]{2}(?:$|-[0-9]{2}(?:$|T)))/.exec(value)?.[1]);
  return validYear(year) ? year : undefined;
}

export function parseFilmJsonLd(pageUrl: string, scripts: Iterable<string>): Film | undefined {
  const csfdId = csfdIdFromUrl(pageUrl);
  if (!csfdId) return undefined;

  const candidates = [];
  for (const script of scripts) {
    let value: unknown;
    try {
      value = JSON.parse(script);
    } catch {
      continue;
    }
    for (const node of workNodes(value)) {
      const types = typesOf(node);
      const ids = referencedIds(node);
      if (types.length && ids.every((id) => id === csfdId)) {
        candidates.push({ node, types, refersToPage: ids.includes(csfdId) });
      }
    }
  }

  const matching = candidates.filter((candidate) => candidate.refersToPage);
  const relevant = matching.length ? matching : candidates;
  if (relevant.some(({ types }) => types.some((type) => type !== 'Movie'))) return undefined;
  const names = new Set(relevant.map(({ node }) => textValue(node.name)).filter(Boolean));
  if (names.size > 1) return undefined;
  const selected = relevant.find(({ node }) => textValue(node.name)) ?? relevant[0];
  if (!selected) return undefined;
  const { node } = selected;
  const directors = (Array.isArray(node.director) ? node.director : [node.director])
    .map((director) => textValue(isRecord(director) ? director.name : director))
    .filter((name): name is string => name !== undefined);

  return {
    type: 'Movie',
    csfdId,
    title: textValue(node.name),
    year: yearOf(node.dateCreated) ?? yearOf(node.datePublished),
    directors: [...new Set(directors)].slice(0, 20),
  };
}
