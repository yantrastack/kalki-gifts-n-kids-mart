import { createElement, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import type { Theme } from '../theme';

const fmtTime = (s: number) => {
  const v = Math.max(0, Math.floor(Number.isFinite(s) ? s : 0));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

type PlayerProps = {
  uri: string;
  width: number;
  height: number;
  theme: Theme;
  autoPlay?: boolean;
};

/**
 * A polished video player for the product media carousel: tap to play/pause,
 * big centre button when paused, and a bottom bar with a seekable progress
 * track, elapsed/total time, and a mute toggle.
 *
 * On the web (the primary way customers open the shop) it drives a plain
 * `<video>` element directly — expo-video's web player doesn't reliably start
 * playback in static exports. Native apps keep the expo-video path.
 */
export default function VideoPlayer(props: PlayerProps) {
  return Platform.OS === 'web' ? <WebPlayer {...props} /> : <NativePlayer {...props} />;
}

/* ------------------------------------------------------------------ web player */
function WebPlayer({ uri, width, height, theme, autoPlay = true }: PlayerProps) {
  const videoRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const barWidth = useRef(1);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setPosition(el.currentTime || 0);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onVolume = () => setMuted(el.muted);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('volumechange', onVolume);
    if (autoPlay) el.play().catch(() => {}); // muted autoplay; browsers may still decline
    // Safety net: some browsers halt background media without firing events.
    const poll = setInterval(() => {
      setPlaying(!el.paused);
      setMuted(el.muted);
      setPosition(el.currentTime || 0);
    }, 500);
    return () => {
      clearInterval(poll);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('volumechange', onVolume);
    };
  }, [autoPlay]);

  const lastToggle = useRef(0);
  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    // Guard against environments that dispatch a double click per tap.
    const now = Date.now();
    if (now - lastToggle.current < 250) return;
    lastToggle.current = now;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  };
  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };
  const seek = (e: any) => {
    const el = videoRef.current;
    const x = e?.nativeEvent?.locationX ?? e?.nativeEvent?.offsetX ?? 0;
    if (el && duration > 0 && barWidth.current > 0) {
      el.currentTime = Math.min(Math.max((x / barWidth.current) * duration, 0), duration);
    }
  };

  const video = createElement('video', {
    ref: videoRef,
    src: uri,
    muted: true,
    loop: true,
    playsInline: true,
    preload: 'metadata',
    style: { width, height, objectFit: 'cover', display: 'block', backgroundColor: '#000' },
  });

  return (
    <Chrome
      width={width}
      height={height}
      theme={theme}
      playing={playing}
      muted={muted}
      position={position}
      duration={duration}
      onToggle={togglePlay}
      onMute={toggleMute}
      onSeek={seek}
      onBarLayout={(w) => {
        barWidth.current = w;
      }}
    >
      {video}
    </Chrome>
  );
}

/* --------------------------------------------------------------- native player */
function NativePlayer({ uri, width, height, theme, autoPlay = true }: PlayerProps) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    if (autoPlay) p.play();
  });
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const barWidth = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      try {
        setPlaying(player.playing);
        setMuted(player.muted);
        setPosition(player.currentTime || 0);
        if (Number.isFinite(player.duration) && player.duration > 0) setDuration(player.duration);
      } catch {
        /* player released */
      }
    }, 250);
    return () => clearInterval(id);
  }, [player]);

  return (
    <Chrome
      width={width}
      height={height}
      theme={theme}
      playing={playing}
      muted={muted}
      position={position}
      duration={duration}
      onToggle={() => (player.playing ? player.pause() : player.play())}
      onMute={() => {
        player.muted = !player.muted;
        setMuted(player.muted);
      }}
      onSeek={(e: any) => {
        const x = e?.nativeEvent?.locationX ?? 0;
        if (duration > 0 && barWidth.current > 0) {
          player.currentTime = Math.min(Math.max((x / barWidth.current) * duration, 0), duration);
        }
      }}
      onBarLayout={(w) => {
        barWidth.current = w;
      }}
    >
      <VideoView
        player={player}
        style={{ width, height }}
        contentFit="cover"
        nativeControls={false}
      />
    </Chrome>
  );
}

/* ------------------------------------------------------------- shared controls */
function Chrome({
  width,
  height,
  theme,
  playing,
  muted,
  position,
  duration,
  onToggle,
  onMute,
  onSeek,
  onBarLayout,
  children,
}: {
  width: number;
  height: number;
  theme: Theme;
  playing: boolean;
  muted: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onMute: () => void;
  onSeek: (e: any) => void;
  onBarLayout: (w: number) => void;
  children: React.ReactNode;
}) {
  const progress = duration > 0 ? Math.min(position / duration, 1) : 0;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {children}

      {/* Tap layer: play/pause */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onToggle}>
        {!playing && (
          <View style={styles.centerWrap} pointerEvents="none">
            <View style={[styles.centerBtn, { backgroundColor: theme.accent }]}>
              <Feather name="play" size={30} color="#fff" style={{ marginLeft: 4 }} />
            </View>
          </View>
        )}
      </Pressable>

      {/* Bottom control bar */}
      <View style={styles.barScrim} pointerEvents="box-none">
        <Pressable onPress={onToggle} hitSlop={8} style={styles.smallBtn}>
          <Feather name={playing ? 'pause' : 'play'} size={16} color="#fff" />
        </Pressable>

        <Pressable
          onPress={onSeek}
          onLayout={(e) => onBarLayout(e.nativeEvent.layout.width)}
          style={styles.track}
          hitSlop={{ top: 10, bottom: 10 }}
        >
          <View style={styles.trackBg} />
          <View
            style={[
              styles.trackFill,
              { width: `${progress * 100}%`, backgroundColor: theme.accent },
            ]}
          />
          <View
            style={[styles.knob, { left: `${progress * 100}%`, backgroundColor: theme.accent }]}
          />
        </Pressable>

        <Text style={styles.time}>
          {fmtTime(position)} / {fmtTime(duration)}
        </Text>

        <Pressable onPress={onMute} hitSlop={8} style={styles.smallBtn}>
          <Feather name={muted ? 'volume-x' : 'volume-2'} size={16} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  barScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  smallBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  track: { flex: 1, height: 14, justifyContent: 'center' },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  knob: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  time: { color: '#fff', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
