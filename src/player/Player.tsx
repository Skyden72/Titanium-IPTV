import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Channel } from '../types/media';
import { useAppStore } from '../store/useAppStore';

type Engine = 'dash' | 'hls' | 'native' | 'idle';

type DashMediaPlayerInstance = {
  initialize?: (video: HTMLVideoElement, url: string, autoPlay?: boolean) => void;
  reset?: () => void;
  destroy?: () => void;
};

type DashMediaPlayerFactory = DashMediaPlayerInstance & {
  create?: () => DashMediaPlayerInstance;
};

type DashModuleShape = {
  MediaPlayer?: () => DashMediaPlayerFactory;
  default?: DashModuleShape;
};

type HlsInstance = {
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  loadSource: (url: string) => void;
  attachMedia: (video: HTMLVideoElement) => void;
  destroy?: () => void;
};

type HlsConstructorShape = {
  new (): HlsInstance;
  isSupported?: () => boolean;
  Events?: Record<string, string>;
};

type LoaderOverrides = {
  loadDash?: () => Promise<DashModuleShape | null>;
  loadHls?: () => Promise<unknown>;
};

type PlayerProps = {
  source?: string | Channel;
  autoPlay?: boolean;
  poster?: string;
  engineLoaders?: LoaderOverrides;
};

type Stats = {
  resolution?: string;
  droppedFrames?: number;
  totalFrames?: number;
};

type VideoWithQuality = HTMLVideoElement & {
  getVideoPlaybackQuality?: () => {
    droppedVideoFrames?: number;
    totalVideoFrames?: number;
  };
  webkitDroppedFrameCount?: number;
  webkitDecodedFrameCount?: number;
};

const pickHls = (mod: unknown): HlsConstructorShape | null => {
  if (!mod) {
    return null;
  }

  const candidate = mod as { default?: unknown; Hls?: unknown };
  const possibilities: unknown[] = [
    (candidate.default as { default?: unknown } | undefined)?.default,
    candidate.default,
    candidate.Hls,
    mod,
  ];

  for (const possibility of possibilities) {
    if (typeof possibility === 'function') {
      return possibility as HlsConstructorShape;
    }
  }

  return null;
};

const pickDash = (mod: unknown): DashModuleShape | null => {
  if (!mod || typeof mod !== 'object') {
    return null;
  }
  const candidate = mod as DashModuleShape;
  if (candidate?.default?.MediaPlayer) {
    return candidate.default;
  }
  if (candidate?.MediaPlayer) {
    return candidate;
  }
  return null;
};

const defaultDashLoader = async () => import('dashjs').then(pickDash);
const defaultHlsLoader = async () => import('hls.js').then(pickHls);

const attemptPlay = (video: HTMLVideoElement) => {
  try {
    const result = video.play?.();
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch((error: unknown) => {
        console.warn('Autoplay failed', error);
      });
    }
  } catch (error) {
    console.warn('Autoplay failed', error);
  }
};

class PlayerErrorBoundary extends React.Component<React.PropsWithChildren> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error('Player rendering error', error);
  }

  override render() {
    if (this.state.hasError) {
      return <div role="alert">Playback is currently unavailable.</div>;
    }
    return this.props.children;
  }
}

const getSourceUrl = (source?: string | Channel): string | undefined => {
  if (!source) {
    return undefined;
  }

  if (typeof source === 'string') {
    return source;
  }

  return source.url;
};

const getExtension = (url: string): string => {
  try {
    const parsed = new URL(url, 'relative:///');
    const pathname = parsed.pathname || '';
    const ext = pathname.split('.').pop();
    return (ext ?? '').toLowerCase();
  } catch (error) {
    console.warn('Unable to parse media url', error);
    return '';
  }
};

const shouldUseDash = (extension: string) => extension === 'mpd';
const shouldUseHls = (extension: string) => extension === 'm3u8';

function usePlayerStats(videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean): Stats {
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    let rafId: number | undefined;

    const update = () => {
      const resolution = video.videoWidth && video.videoHeight
        ? `${video.videoWidth}x${video.videoHeight}`
        : undefined;

      let droppedFrames: number | undefined;
      let totalFrames: number | undefined;

      try {
        const enhancedVideo = video as VideoWithQuality;
        const quality = enhancedVideo.getVideoPlaybackQuality?.();
        if (quality) {
          droppedFrames = Number.isFinite(quality.droppedVideoFrames)
            ? quality.droppedVideoFrames
            : undefined;
          totalFrames = Number.isFinite(quality.totalVideoFrames)
            ? quality.totalVideoFrames
            : undefined;
        } else if (
          Number.isFinite(enhancedVideo.webkitDroppedFrameCount) &&
          Number.isFinite(enhancedVideo.webkitDecodedFrameCount)
        ) {
          droppedFrames = enhancedVideo.webkitDroppedFrameCount;
          totalFrames = enhancedVideo.webkitDecodedFrameCount;
        }
      } catch (error) {
        console.warn('Unable to read playback quality', error);
      }

      setStats({ resolution, droppedFrames, totalFrames });
      rafId = window.requestAnimationFrame(update);
    };

    rafId = window.requestAnimationFrame(update);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [videoRef, enabled]);

  return stats;
}

const PlayerBody: React.FC<PlayerProps> = ({
  source,
  autoPlay,
  poster,
  engineLoaders,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [engine, setEngine] = useState<Engine>('idle');
  const autoplaySetting = useAppStore((state) => state.settings.autoplay);
  const showStats = useAppStore((state) => state.settings.showStats);

  const url = useMemo(() => getSourceUrl(source), [source]);

  const loaders = useMemo(
    () => ({
      loadDash: engineLoaders?.loadDash ?? defaultDashLoader,
      loadHls: engineLoaders?.loadHls ?? defaultHlsLoader,
    }),
    [engineLoaders],
  );

  const stats = usePlayerStats(videoRef, showStats);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url || typeof window === 'undefined') {
      return undefined;
    }

    let cleanup: (() => void) | undefined;

    const tryDash = async (): Promise<boolean> => {
      try {
        const dashModule = await loaders.loadDash().catch(() => null);
        const dash = pickDash(dashModule);
        if (dash && typeof dash.MediaPlayer === 'function') {
          const factory = dash.MediaPlayer();
          const player = typeof factory.create === 'function' ? factory.create() : factory;
          if (player && typeof player.initialize === 'function') {
            player.initialize(video, url, autoPlay ?? autoplaySetting);
            setEngine('dash');
            cleanup = () => {
              try {
                player.reset?.();
                player.destroy?.();
              } catch (error) {
                console.warn('Unable to reset dash player', error);
              }
            };
            return true;
          }
        }
      } catch (error) {
        console.warn('DASH playback failed, falling back', error);
      }
      return false;
    };

    const tryHls = async (): Promise<boolean> => {
      try {
        const HlsCtor = await loaders
          .loadHls()
          .then((module) => pickHls(module))
          .catch(() => null);

        if (
          HlsCtor &&
          typeof HlsCtor.isSupported === 'function' &&
          HlsCtor.isSupported() &&
          typeof HlsCtor === 'function'
        ) {
          const instance = new HlsCtor();
          instance.on?.(HlsCtor.Events?.ERROR ?? 'hlsError', (event: unknown) => {
            console.error('HLS error', event);
          });
          instance.loadSource(url);
          instance.attachMedia(video);
          if (autoPlay ?? autoplaySetting) {
            instance.on?.(HlsCtor.Events?.MANIFEST_PARSED ?? 'manifestParsed', () => {
              attemptPlay(video);
            });
          }
          setEngine('hls');
          cleanup = () => {
            try {
              instance.destroy?.();
            } catch (error) {
              console.warn('Unable to destroy HLS instance', error);
            }
          };
          return true;
        }
      } catch (error) {
        console.warn('HLS playback failed, falling back', error);
      }
      return false;
    };

    const setup = async () => {
      const extension = getExtension(url);
      const preferDash = shouldUseDash(extension);
      const preferHls = shouldUseHls(extension);

      if (preferDash && (await tryDash())) {
        return;
      }

      if ((preferHls || preferDash) && (await tryHls())) {
        return;
      }

      try {
        video.src = url;
        if (autoPlay ?? autoplaySetting) {
          attemptPlay(video);
        }
        setEngine('native');
        cleanup = () => {
          video.pause();
          video.removeAttribute('src');
          video.load();
        };
      } catch (error) {
        console.error('Native playback failed', error);
        setEngine('idle');
      }
    };

    void setup();

    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [url, autoPlay, autoplaySetting, loaders, videoRef]);

  return (
    <div className="player" data-engine={engine}>
      <video ref={videoRef} controls poster={poster} playsInline />
      {showStats && (
        <div className="player__stats" aria-live="polite">
          <span className="player__stats-engine">Engine: {engine.toUpperCase()}</span>
          <span className="player__stats-resolution">
            Resolution: {stats.resolution ?? 'unknown'}
          </span>
          <span className="player__stats-dropped">
            Dropped Frames: {stats.droppedFrames ?? 0}
          </span>
          {typeof stats.totalFrames === 'number' && (
            <span className="player__stats-total">Total Frames: {stats.totalFrames}</span>
          )}
        </div>
      )}
    </div>
  );
};

const Player: React.FC<PlayerProps> = (props) => (
  <PlayerErrorBoundary>
    <PlayerBody {...props} />
  </PlayerErrorBoundary>
);

export default Player;
export { pickDash, pickHls };
