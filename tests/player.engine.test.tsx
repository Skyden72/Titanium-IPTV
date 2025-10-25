import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Player, { pickDash, pickHls } from '../src/player/Player';

const createDashMock = () => ({
  MediaPlayer: vi.fn(() => ({
    create: vi.fn(() => ({
      initialize: vi.fn(),
      reset: vi.fn(),
      destroy: vi.fn(),
    })),
  })),
});

const createHlsMock = () =>
  class MockHls {
    static isSupported() {
      return true;
    }

    static Events = {
      ERROR: 'error',
      MANIFEST_PARSED: 'manifestParsed',
    };

    on = vi.fn();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    destroy = vi.fn();
  };

describe('pick helpers', () => {
  it('normalizes hls module shapes', () => {
    expect(typeof pickHls({ default: createHlsMock() })).toBe('function');
    expect(typeof pickHls({ Hls: createHlsMock() })).toBe('function');
    expect(typeof pickHls({ default: { default: createHlsMock() } })).toBe('function');
  });

  it('normalizes dash module shapes', () => {
    const dash = createDashMock();
    expect(pickDash({ default: dash })).toEqual(dash);
    expect(pickDash(dash)).toEqual(dash);
    expect(pickDash({})).toBeNull();
  });
});

describe('Player engine selection', () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    console.error = originalError;
  });

  it('prefers DASH for MPD sources', async () => {
    const dashMock = createDashMock();

    const { container } = render(
      <Player
        source="https://example.com/stream.mpd"
        engineLoaders={{
          loadDash: () => Promise.resolve(dashMock),
          loadHls: () => Promise.reject(new Error('No HLS')),
        }}
      />,
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-engine]')?.getAttribute('data-engine'),
      ).toBe('dash'),
    );
    const playerFactory = dashMock.MediaPlayer;
    expect(playerFactory).toHaveBeenCalled();
  });

  it('falls back to HLS for m3u8 streams', async () => {
    const dashLoader = vi.fn(() => Promise.reject(new Error('dash error')));
    const HlsCtor = createHlsMock();

    const { container } = render(
      <Player
        source="https://example.com/live.m3u8"
        engineLoaders={{
          loadDash: dashLoader,
          loadHls: () => Promise.resolve({ default: HlsCtor }),
        }}
      />,
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-engine]')?.getAttribute('data-engine'),
      ).toBe('hls'),
    );
  });

  it('falls back to native video when no engine available', async () => {
    const { container } = render(
      <Player
        source="https://example.com/video.mp4"
        engineLoaders={{
          loadDash: () => Promise.reject(new Error('dash error')),
          loadHls: () => Promise.reject(new Error('hls error')),
        }}
      />,
    );

    await waitFor(() =>
      expect(
        container.querySelector('[data-engine]')?.getAttribute('data-engine'),
      ).toBe('native'),
    );
  });

  it('always renders a video element', () => {
    const { container } = render(<Player />);
    expect(container.querySelectorAll('video').length).toBe(1);
  });
});
