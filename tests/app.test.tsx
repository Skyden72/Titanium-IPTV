import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { useAppStore } from '../src/store/useAppStore';

const playlistM3U = `#EXTM3U
#EXTINF:-1 tvg-id="news" tvg-name="News Channel",News Channel
https://example.com/live/news.m3u8
#EXTINF:-1 tvg-id="sports" tvg-name="Sports HD",Sports HD
https://example.com/live/sports.mpd
`;

const epgXml = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <programme start="20240101060000 +0000" stop="20240101070000 +0000" channel="news">
    <title>Morning Headlines</title>
    <desc>Top stories from overnight.</desc>
  </programme>
  <programme start="20240101070000 +0000" stop="20240101080000 +0000" channel="news">
    <title>Financial News</title>
  </programme>
</tv>`;

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useAppStore.setState({
      profile: {},
      settings: { autoplay: false, showStats: true },
      playlistSource: null,
      playlistStatus: 'idle',
      epgStatus: 'idle',
      channels: [],
      epg: {},
      selectedChannelKey: null,
    });
  });

  it('loads playlist and allows channel selection', async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL) => {
      if (`${url}`.includes('playlist')) {
        return Promise.resolve(
          new Response(playlistM3U, {
            status: 200,
            headers: { 'Content-Type': 'application/vnd.apple.mpegurl' },
          }),
        );
      }
      if (`${url}`.includes('guide')) {
        return Promise.resolve(
          new Response(epgXml, {
            status: 200,
            headers: { 'Content-Type': 'application/xml' },
          }),
        );
      }
      return Promise.reject(new Error('Unexpected request'));
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('https://example.com/playlist.m3u'), {
      target: { value: 'https://demo.example/playlist.m3u' },
    });
    fireEvent.click(screen.getByRole('button', { name: /load playlist/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    await screen.findByRole('button', { name: /news channel/i });

    expect(screen.getByRole('button', { name: /news channel/i })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByPlaceholderText('https://example.com/guide.xml'), {
      target: { value: 'https://demo.example/guide.xml' },
    });
    fireEvent.click(screen.getByRole('button', { name: /load epg/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    await screen.findByText(/morning headlines/i);
  });

  it('shows a toast when playlist loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response('not found', {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
          }),
        ),
      ) as typeof fetch,
    );

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('https://example.com/playlist.m3u'), {
      target: { value: 'https://demo.example/playlist.m3u' },
    });
    fireEvent.click(screen.getByRole('button', { name: /load playlist/i }));

    await screen.findByText(/failed to load playlist/i);
  });
});
