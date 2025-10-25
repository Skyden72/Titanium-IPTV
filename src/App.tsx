import React, { useCallback, useMemo, useState } from 'react';
import Player from './player/Player';
import { parseM3U } from './services/playlist';
import { parseXmltv } from './services/xmltv';
import { useAppStore, getChannelKey } from './store/useAppStore';
import type { Channel } from './types/media';

type Toast = {
  id: number;
  message: string;
};

const MAX_VISIBLE_TOASTS = 3;

const getChannelDisplayName = (channel: Channel): string =>
  channel.name || channel.id || channel.url;

const formatTime = (timestamp: number): string => {
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  const date = new Date(timestamp);
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}`;
};

const App: React.FC = () => {
  const {
    channels,
    epg,
    playlistStatus,
    epgStatus,
    selectedChannelKey,
    setChannels,
    setPlaylistSource,
    setPlaylistStatus,
    setEpg,
    setEpgStatus,
    selectChannel,
  } = useAppStore((state) => ({
    channels: state.channels,
    epg: state.epg,
    playlistStatus: state.playlistStatus,
    epgStatus: state.epgStatus,
    selectedChannelKey: state.selectedChannelKey,
    setChannels: state.setChannels,
    setPlaylistSource: state.setPlaylistSource,
    setPlaylistStatus: state.setPlaylistStatus,
    setEpg: state.setEpg,
    setEpgStatus: state.setEpgStatus,
    selectChannel: state.selectChannel,
  }));
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string) => {
    setToasts((current) => {
      const toast = { id: Date.now() + Math.random(), message };
      const next = [...current, toast];
      return next.slice(-MAX_VISIBLE_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const selectedChannel = useMemo(
    () => channels.find((channel) => getChannelKey(channel) === selectedChannelKey),
    [channels, selectedChannelKey],
  );

  const programs = useMemo(() => {
    if (!selectedChannel) {
      return [];
    }
    const possibleKeys = [
      selectedChannel.id?.trim(),
      selectedChannel.id?.trim().toLowerCase(),
      selectedChannel.url.trim(),
      selectedChannel.url.trim().toLowerCase(),
    ].filter(Boolean) as string[];

    for (const key of possibleKeys) {
      const found = epg[key];
      if (found) {
        return found;
      }
    }
    return [];
  }, [epg, selectedChannel]);

  const loadPlaylist = useCallback(async () => {
    if (!playlistUrl.trim()) {
      pushToast('Enter a playlist URL to load channels.');
      return;
    }
    setPlaylistStatus('loading');
    try {
      const response = await fetch(playlistUrl, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error(`Playlist request failed with status ${response.status}`);
      }
      const text = await response.text();
      const parsedChannels = parseM3U(text);
      setChannels(parsedChannels);
      setPlaylistSource({ title: playlistUrl, url: playlistUrl, lastUpdated: Date.now() });
      setPlaylistStatus('ready');
    } catch (error) {
      console.error('Failed to load playlist', error);
      setPlaylistStatus('error');
      pushToast('Failed to load playlist. Please check the URL and try again.');
    }
  }, [playlistUrl, pushToast, setChannels, setPlaylistSource, setPlaylistStatus]);

  const loadEpg = useCallback(async () => {
    if (!epgUrl.trim()) {
      pushToast('Enter an EPG URL to load guide data.');
      return;
    }
    setEpgStatus('loading');
    try {
      const response = await fetch(epgUrl, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        throw new Error(`EPG request failed with status ${response.status}`);
      }
      const xml = await response.text();
      const parsed = parseXmltv(xml);
      setEpg(parsed);
      setEpgStatus('ready');
    } catch (error) {
      console.error('Failed to load EPG', error);
      setEpgStatus('error');
      pushToast('Failed to load EPG. Please verify the source and retry.');
    }
  }, [epgUrl, pushToast, setEpg, setEpgStatus]);

  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      const key = getChannelKey(channel);
      selectChannel(key);
    },
    [selectChannel],
  );

  return (
    <div className="app">
      <header className="app__header">
        <h1>Titanium IPTV</h1>
      </header>
      <main className="app__layout">
        <aside className="app__sidebar">
          <section aria-label="Playlist Loader" className="app__panel">
            <h2>Playlist</h2>
            <label className="app__field">
              <span>Playlist URL</span>
              <input
                type="url"
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="https://example.com/playlist.m3u"
              />
            </label>
            <button type="button" onClick={loadPlaylist} disabled={playlistStatus === 'loading'}>
              {playlistStatus === 'loading' ? 'Loading…' : 'Load Playlist'}
            </button>
          </section>
          <section aria-label="EPG Loader" className="app__panel">
            <h2>EPG</h2>
            <label className="app__field">
              <span>EPG URL</span>
              <input
                type="url"
                value={epgUrl}
                onChange={(event) => setEpgUrl(event.target.value)}
                placeholder="https://example.com/guide.xml"
              />
            </label>
            <button type="button" onClick={loadEpg} disabled={epgStatus === 'loading'}>
              {epgStatus === 'loading' ? 'Loading…' : 'Load EPG'}
            </button>
          </section>
          <section aria-label="Channel List" className="app__panel">
            <h2>Channels</h2>
            {channels.length === 0 && <p>No channels loaded.</p>}
            <ul className="app__channel-list">
              {channels.map((channel) => {
                const key = getChannelKey(channel);
                const isActive = key === selectedChannelKey;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => handleSelectChannel(channel)}
                      className={isActive ? 'app__channel app__channel--active' : 'app__channel'}
                      aria-pressed={isActive}
                    >
                      <span>{getChannelDisplayName(channel)}</span>
                      {channel.group && <small className="app__channel-group">{channel.group}</small>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
        <section className="app__content">
          {selectedChannel ? (
            <>
              <div className="app__now-playing" aria-live="polite">
                <h2>Now Playing: {getChannelDisplayName(selectedChannel)}</h2>
              </div>
              <Player source={selectedChannel} autoPlay />
              <section className="app__epg" aria-label="Program Guide">
                <h3>Upcoming Programs</h3>
                {programs.length === 0 ? (
                  <p>No EPG data available.</p>
                ) : (
                  <ul>
                    {programs.map((program) => (
                      <li key={`${program.start}-${program.end}`}>
                        <strong>{formatTime(program.start)}</strong> – <span>{program.title}</span>
                        {program.description && <p>{program.description}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : (
            <div className="app__placeholder">
              <p>Select a channel to start playback.</p>
            </div>
          )}
        </section>
      </main>
      {toasts.length > 0 && (
        <div className="app__toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className="app__toast">
              <span>{toast.message}</span>
              <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
