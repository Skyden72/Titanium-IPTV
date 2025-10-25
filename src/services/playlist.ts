import type { Channel } from '../types/media';

const EXTINF_REGEX = /^#EXTINF:(-?\d+)\s*(.*)$/i;
const ATTRIBUTE_REGEX = /(\w[\w-]*)="([^"]*)"/g;

interface ChannelMeta {
  id?: string;
  name?: string;
  logo?: string;
  group?: string;
  duration?: number;
  userAgent?: string;
}

const ATTRIBUTE_MAP: Record<string, keyof Omit<ChannelMeta, 'duration'>> = {
  'tvg-id': 'id',
  'tvg-name': 'name',
  'tvg-logo': 'logo',
  'group-title': 'group',
  'user-agent': 'userAgent',
};

const BOM = /^(\uFEFF)/;

export function parseM3U(input: string): Channel[] {
  const text = input.replace(BOM, '').trim();
  if (!text.startsWith('#EXTM3U')) {
    throw new Error('Invalid M3U playlist: missing #EXTM3U header');
  }

  const lines = text.split(/\r?\n/);
  const channels: Channel[] = [];
  const indexByKey = new Map<string, number>();
  let pendingMeta: ChannelMeta | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.toUpperCase() === '#EXTM3U') {
      continue;
    }

    if (line.startsWith('#EXTINF')) {
      const match = line.match(EXTINF_REGEX);
      if (!match) {
        pendingMeta = null;
        continue;
      }

      const [, durationStr, rest] = match;
      const duration = Number.parseInt(durationStr, 10);
      const [attributePart = '', namePart = ''] = rest.split(',', 2);

      const meta: ChannelMeta = { duration: Number.isNaN(duration) ? undefined : duration };

      let attrMatch: RegExpExecArray | null;
      ATTRIBUTE_REGEX.lastIndex = 0;
      while ((attrMatch = ATTRIBUTE_REGEX.exec(attributePart)) !== null) {
        const [, key, value] = attrMatch;
        const normalizedKey = key.toLowerCase();
        const metaKey = ATTRIBUTE_MAP[normalizedKey];
        if (metaKey) {
          meta[metaKey] = value.trim();
        }
      }

      if (namePart.trim()) {
        meta.name = namePart.trim();
      }

      pendingMeta = meta;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    const url = line;
    const meta = pendingMeta ?? {};
    pendingMeta = null;

    const channel: Channel = {
      id: meta.id?.trim() || undefined,
      name: (meta.name ?? '').trim() || undefined,
      logo: meta.logo?.trim() || undefined,
      group: meta.group?.trim() || undefined,
      duration: meta.duration,
      userAgent: meta.userAgent?.trim() || undefined,
      url: url.trim(),
    };

    if (!channel.name) {
      channel.name = channel.id || channel.url;
    }

    const key = (channel.id || channel.url).toLowerCase();
    if (indexByKey.has(key)) {
      const idx = indexByKey.get(key)!;
      channels[idx] = {
        ...channels[idx],
        ...channel,
      };
    } else {
      indexByKey.set(key, channels.length);
      channels.push(channel);
    }
  }

  return channels;
}
