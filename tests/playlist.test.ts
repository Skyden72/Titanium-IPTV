import { describe, expect, it } from 'vitest';
import { parseM3U } from '../src/services/playlist';

describe('parseM3U', () => {
  it('parses channels with attributes and urls', () => {
    const playlist = `#EXTM3U\n#EXTINF:-1 tvg-id="channel1" tvg-name="Channel One" tvg-logo="logo1.png",Channel 1\nhttp://example.com/stream1.m3u8\n#EXTINF:-1 tvg-id="channel2" group-title="News" user-agent="CustomAgent",Channel 2\nhttp://example.com/stream2.mpd`;

    const channels = parseM3U(playlist);

    expect(channels).toHaveLength(2);
    expect(channels[0]).toMatchObject({
      id: 'channel1',
      name: 'Channel 1',
      logo: 'logo1.png',
      url: 'http://example.com/stream1.m3u8',
    });
    expect(channels[1]).toMatchObject({
      id: 'channel2',
      name: 'Channel 2',
      group: 'News',
      userAgent: 'CustomAgent',
      url: 'http://example.com/stream2.mpd',
    });
  });

  it('coalesces duplicate channels by id and tolerates missing metadata', () => {
    const playlist = `\uFEFF#EXTM3U\n#EXTINF:-1 tvg-id="dup" tvg-name="First"\nhttp://example.com/one\n#EXTINF:-1 tvg-id="dup" tvg-logo="logo.png",Duplicate\nhttp://example.com/one`;

    const channels = parseM3U(playlist);
    expect(channels).toHaveLength(1);
    expect(channels[0]).toMatchObject({
      id: 'dup',
      name: 'Duplicate',
      logo: 'logo.png',
    });
  });

  it('ignores comments and blank lines', () => {
    const playlist = `#EXTM3U\n# This is a comment\n\n#EXTINF:-1,Channel\nhttp://example.com/basic`;

    const channels = parseM3U(playlist);
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe('Channel');
  });
});
