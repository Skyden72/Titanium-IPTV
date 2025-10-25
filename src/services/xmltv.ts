import { DOMParser } from '@xmldom/xmldom';
import type { EpgIndex, Program } from '../types/media';

const memoized = new Map<string, EpgIndex>();

function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

export function parseXmltvDate(value: string | null | undefined): number {
  if (!value) {
    return Number.NaN;
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*(Z|[+-]\d{4}))?$/);
  if (!match) {
    return Number.NaN;
  }

  const [, year, month, day, hour, minute, second, zone] = match;
  const utc = Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
    Number.parseInt(minute, 10),
    Number.parseInt(second, 10),
  );

  if (!zone || zone === 'Z') {
    return utc;
  }

  const sign = zone.startsWith('-') ? -1 : 1;
  const offsetHours = Number.parseInt(zone.slice(1, 3), 10);
  const offsetMinutes = Number.parseInt(zone.slice(3, 5), 10);
  const totalOffsetMinutes = sign * (offsetHours * 60 + offsetMinutes);

  return utc - totalOffsetMinutes * 60 * 1000;
}

function getTextContent(element: Element | null, tagName: string): string | undefined {
  if (!element) {
    return undefined;
  }
  const nodes = element.getElementsByTagName(tagName);
  if (!nodes || nodes.length === 0) {
    return undefined;
  }
  const text = nodes.item(0)?.textContent?.trim();
  return text || undefined;
}

function clampProgram(program: Program): Program {
  if (program.end <= program.start) {
    return { ...program, end: program.start };
  }
  return program;
}

export function parseXmltv(xml: string): EpgIndex {
  const text = xml.replace(/^\uFEFF/, '');
  const key = hashString(text);
  const cached = memoized.get(key);
  if (cached) {
    return cached;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(text, 'text/xml');
  const programmes = Array.from(document.getElementsByTagName('programme'));
  const index: EpgIndex = {};

  for (const programme of programmes) {
    const channelId = programme.getAttribute('channel')?.trim();
    if (!channelId) {
      continue;
    }

    const start = parseXmltvDate(programme.getAttribute('start'));
    const end = parseXmltvDate(programme.getAttribute('stop'));
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }

    const title = getTextContent(programme, 'title') ?? '';
    const description = getTextContent(programme, 'desc') ?? undefined;

    const program: Program = clampProgram({
      channel: channelId,
      title,
      description,
      start,
      end,
    });

    if (!index[channelId]) {
      index[channelId] = [];
    }

    index[channelId].push(program);
  }

  for (const channelId of Object.keys(index)) {
    index[channelId] = index[channelId]
      .sort((a, b) => a.start - b.start)
      .map((program) => ({ ...program }));
  }

  memoized.set(key, index);
  return index;
}
