/*
 * Pure video sound / autoplay helpers (no React Native imports), used by the Discover reels
 * and unit-tested from apps/stockwell (see reelAudio.test.ts). YAN-107.
 */

/** Does a video have sound? `unknown` until the browser can tell. */
export type AudioPresence = 'yes' | 'no' | 'unknown';

/** What the reel speaker button should reflect for the slide on screen. */
export type ReelSound = 'none' | AudioPresence;

/** The parts of an HTML `<video>` element these helpers read and drive. */
export type VideoLike = {
  muted: boolean;
  paused: boolean;
  currentTime?: number;
  play: () => Promise<void> | void;
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  audioTracks?: { length: number };
};

/**
 * Whether a loaded `<video>` has an audio track. Each browser exposes this differently:
 * Firefox `mozHasAudio`, Safari `audioTracks`, Chrome only counts decoded audio bytes, so
 * a zero count means "no sound" only after a second of playback has been decoded.
 */
export function audioPresence(el: VideoLike, minPlayedSec = 1): AudioPresence {
  if (typeof el.mozHasAudio === 'boolean') return el.mozHasAudio ? 'yes' : 'no';
  if (el.audioTracks && typeof el.audioTracks.length === 'number') {
    return el.audioTracks.length > 0 ? 'yes' : 'no';
  }
  if (typeof el.webkitAudioDecodedByteCount === 'number') {
    if (el.webkitAudioDecodedByteCount > 0) return 'yes';
    return (el.currentTime ?? 0) >= minPlayedSec ? 'no' : 'unknown';
  }
  return 'unknown';
}

/**
 * What the shop's stored metadata says about sound (`ShopMedia.hasAudio`, YAN-108), known
 * before the video loads. Absent (older media) = unknown, so the browser decides.
 */
export function storedAudioPresence(hasAudio?: boolean | null): AudioPresence {
  if (hasAudio === true) return 'yes';
  if (hasAudio === false) return 'no';
  return 'unknown';
}

/** Merge a new reading: once a video is known to have sound, it keeps it. */
export function mergePresence(prev: AudioPresence, next: AudioPresence): AudioPresence {
  if (prev === 'yes' || next === 'yes') return 'yes';
  if (next === 'unknown') return prev;
  return next;
}

/**
 * Show the speaker only for a video slide that has (or may have) sound. Image slides and
 * placeholder reels report `none`; videos with no audio track report `no`.
 */
export function showSpeaker(sound: ReelSound): boolean {
  return sound === 'yes' || sound === 'unknown';
}

/** Outcome of an autoplay attempt. */
export type PlayResult = 'playing' | 'muted' | 'blocked';

/**
 * Start a video, honouring the browser's autoplay policy. Unmuted play may be refused
 * (NotAllowedError) when there was no recent tap; then it falls back to muted playback
 * (`muted`, so the caller can show the muted icon). If even muted play is refused it
 * returns `blocked`, so the caller shows a play button instead of a silently paused video.
 */
export async function playWithFallback(el: VideoLike): Promise<PlayResult> {
  try {
    await el.play();
    return 'playing';
  } catch (err) {
    if (!el.muted && isNotAllowed(err)) {
      el.muted = true;
      try {
        await el.play();
        return 'muted';
      } catch {
        return 'blocked';
      }
    }
    return el.paused ? 'blocked' : 'playing';
  }
}

const isNotAllowed = (err: unknown) =>
  (err as { name?: string } | null)?.name === 'NotAllowedError';

/*
 * Native (expo-video) audio-track detection.
 *
 * expo-video reports `availableAudioTracks`, but an empty list means different things:
 * - before the source has loaded it is always empty (nothing known yet);
 * - Android (ExoPlayer) lists every audio track in the file once loaded, so an empty list
 *   after load, with the video track read, means the file has no sound;
 * - iOS lists only tracks in an "audible" media-selection group (HLS renditions,
 *   multi-language files). A plain MP4 with sound can report none, so empty proves nothing.
 */

/** What expo-video has told us about the current source's tracks. */
export type NativeTrackInfo = {
  platform: string;
  /** `sourceLoad` has fired (or the player was already `readyToPlay`). */
  loaded: boolean;
  audioTracks: number;
  videoTracks: number;
};

/** Does a natively played video have sound, from expo-video's track info? */
export function nativeAudioPresence(info: NativeTrackInfo): AudioPresence {
  if (info.audioTracks > 0) return 'yes';
  if (!info.loaded) return 'unknown';
  if (info.platform === 'android' && info.videoTracks > 0) return 'no';
  return 'unknown';
}

/*
 * Web reel playback lifecycle.
 *
 * Only the reel on screen plays, and only while the tab is visible. When the tab is hidden
 * the playing reel is paused (browsers keep unmuted video audible in background tabs) and
 * resumed on return only if it was playing (or starting) when the tab was hidden: a reel
 * the user or browser had paused stays paused. Mute is never changed here, except by the
 * autoplay fallback, which reports it through `onForcedMute` so the speaker stays truthful.
 */

/** A `<video>` the lifecycle can drive. */
export type PlayableVideo = VideoLike & { pause: () => void };

export type ReelPlaybackHooks = {
  /** The browser refused unmuted play, so the video now plays muted. */
  onForcedMute: () => void;
  /** Whether the play button should show (the on-screen video is stuck paused). */
  onStalled: (stalled: boolean) => void;
};

/** Keeps at most one reel playing: claiming playback pauses the previous owner. */
export type PlaybackGroup = {
  claim: (p: ReelPlayback) => void;
  release: (p: ReelPlayback) => void;
  owner: () => ReelPlayback | null;
};

export function createPlaybackGroup(): PlaybackGroup {
  let current: ReelPlayback | null = null;
  return {
    claim(p) {
      if (current && current !== p) current.yieldPlayback();
      current = p;
    },
    release(p) {
      if (current === p) current = null;
    },
    owner: () => current,
  };
}

export class ReelPlayback {
  private active = false;
  private hidden: boolean;
  /** Paused by us because the tab was hidden; resume when it is visible again. */
  private resumeOnShow = false;
  /** A play() attempt is in flight. */
  private pending = false;
  /** Bumped by every start/pause, so a stale play() result can't act. */
  private token = 0;
  private disposed = false;

  constructor(
    private readonly el: PlayableVideo,
    private readonly hooks: ReelPlaybackHooks,
    private readonly group: PlaybackGroup,
    hidden = false,
  ) {
    this.hidden = hidden;
  }

  /** On screen and the tab visible: the only state in which this reel may play. */
  shouldPlay(): boolean {
    return this.active && !this.hidden && !this.disposed;
  }

  setActive(active: boolean): void {
    if (this.disposed) return;
    this.active = active;
    if (active) {
      if (this.hidden) this.resumeOnShow = true;
      else void this.start();
    } else {
      this.resumeOnShow = false;
      this.stop();
      this.hooks.onStalled(false);
    }
  }

  setHidden(hidden: boolean): void {
    if (this.disposed || hidden === this.hidden) return;
    this.hidden = hidden;
    if (hidden) {
      if (this.active) this.resumeOnShow = this.pending || !this.el.paused;
      this.stop();
    } else if (this.active && this.resumeOnShow) {
      this.resumeOnShow = false;
      void this.start();
    }
  }

  /** Try to play (also the play button's action). Never rejects. */
  async start(): Promise<PlayResult | null> {
    if (!this.shouldPlay()) return null;
    const t = ++this.token;
    this.group.claim(this);
    const wasMuted = this.el.muted;
    this.pending = true;
    let r: PlayResult;
    try {
      r = await playWithFallback(this.el);
    } catch {
      r = this.el.paused ? 'blocked' : 'playing';
    }
    if (t === this.token) this.pending = false;
    // Swiped away, tab hidden or disposed while play() was pending: a late (e.g. muted
    // retry) play must not keep going off screen.
    if (!this.shouldPlay()) {
      if (!this.el.paused) this.el.pause();
      return r;
    }
    if (t !== this.token) return r; // a newer start owns the element now
    if (r === 'muted' && !wasMuted) this.hooks.onForcedMute();
    this.hooks.onStalled(r === 'blocked');
    return r;
  }

  /** The element fired `play` (ours, or e.g. OS media controls). */
  onPlayEvent(): void {
    if (!this.shouldPlay()) {
      this.el.pause();
      return;
    }
    this.group.claim(this);
    this.hooks.onStalled(false);
  }

  /** The element fired `pause`: show the play button only if it should be playing. */
  onPauseEvent(): void {
    if (this.shouldPlay() && !this.pending && this.group.owner() === this) {
      this.hooks.onStalled(true);
    }
  }

  /** Another reel claimed playback. */
  yieldPlayback(): void {
    this.stop();
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
    this.group.release(this);
  }

  private stop(): void {
    this.token++;
    this.pending = false;
    if (!this.el.paused) this.el.pause();
  }
}

/** The tab's visibility, and a subscription to its changes. */
export type VisibilitySource = {
  readonly visibilityState?: string;
  readonly hidden?: boolean;
  addEventListener: (type: 'visibilitychange', fn: () => void) => void;
  removeEventListener: (type: 'visibilitychange', fn: () => void) => void;
};

export function isHidden(doc: VisibilitySource | undefined | null): boolean {
  if (!doc) return false;
  if (typeof doc.visibilityState === 'string') return doc.visibilityState === 'hidden';
  return doc.hidden === true;
}

/** Calls `fn(hidden)` on every tab visibility change; returns the unsubscribe. */
export function watchVisibility(
  doc: VisibilitySource | undefined | null,
  fn: (hidden: boolean) => void,
): () => void {
  if (!doc) return () => {};
  const handler = () => fn(isHidden(doc));
  doc.addEventListener('visibilitychange', handler);
  return () => doc.removeEventListener('visibilitychange', handler);
}
