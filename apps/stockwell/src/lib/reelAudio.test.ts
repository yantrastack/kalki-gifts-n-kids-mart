import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  audioPresence,
  createPlaybackGroup,
  isHidden,
  mergePresence,
  nativeAudioPresence,
  type PlayableVideo,
  playWithFallback,
  ReelPlayback,
  showSpeaker,
  type VideoLike,
  type VisibilitySource,
  watchVisibility,
} from '../../../storefront/src/components/videoAudio';
import { en } from '../../../storefront/src/i18n/en';
import { te } from '../../../storefront/src/i18n/te';

// YAN-107: Discover reels sound — speaker only where there is sound, inline web playback,
// and autoplay refusals never leave a silently paused video.

const storefront = path.join(__dirname, '../../../storefront');
const read = (f: string) => readFileSync(path.join(storefront, f), 'utf8');

const notAllowed = () => Object.assign(new Error('blocked'), { name: 'NotAllowedError' });

/** A fake `<video>`: `refuse(muted)` decides whether a play() call is rejected. */
function fakeVideo(refuse: (muted: boolean) => boolean, muted = false) {
  const calls: boolean[] = [];
  const el: VideoLike = {
    muted,
    paused: true,
    play() {
      calls.push(el.muted);
      if (refuse(el.muted)) return Promise.reject(notAllowed());
      el.paused = false;
      return Promise.resolve();
    },
  };
  return { el, calls };
}

describe('audioPresence (does the video have sound?)', () => {
  it('reads Firefox mozHasAudio', () => {
    expect(audioPresence({ muted: true, paused: true, play() {}, mozHasAudio: true })).toBe('yes');
    expect(audioPresence({ muted: true, paused: true, play() {}, mozHasAudio: false })).toBe('no');
  });

  it('reads Safari audioTracks', () => {
    const base = { muted: true, paused: true, play() {} };
    expect(audioPresence({ ...base, audioTracks: { length: 1 } })).toBe('yes');
    expect(audioPresence({ ...base, audioTracks: { length: 0 } })).toBe('no');
  });

  it('reads Chrome decoded audio bytes, saying "no" only after some playback', () => {
    const base = { muted: true, paused: false, play() {} };
    expect(audioPresence({ ...base, webkitAudioDecodedByteCount: 4096 })).toBe('yes');
    expect(audioPresence({ ...base, webkitAudioDecodedByteCount: 0, currentTime: 0.2 })).toBe(
      'unknown',
    );
    expect(audioPresence({ ...base, webkitAudioDecodedByteCount: 0, currentTime: 1.5 })).toBe('no');
  });

  it('is unknown when the browser exposes nothing', () => {
    expect(audioPresence({ muted: true, paused: true, play() {} })).toBe('unknown');
  });
});

describe('mergePresence', () => {
  it('keeps "yes" once seen and ignores later "unknown" readings', () => {
    expect(mergePresence('yes', 'no')).toBe('yes');
    expect(mergePresence('unknown', 'yes')).toBe('yes');
    expect(mergePresence('no', 'unknown')).toBe('no');
    expect(mergePresence('unknown', 'no')).toBe('no');
  });
});

describe('showSpeaker (no speaker where there is no sound)', () => {
  it('hides it for photo / placeholder slides and silent videos', () => {
    expect(showSpeaker('none')).toBe(false);
    expect(showSpeaker('no')).toBe(false);
  });

  it('shows it for videos with (or possibly with) sound', () => {
    expect(showSpeaker('yes')).toBe(true);
    expect(showSpeaker('unknown')).toBe(true);
  });
});

describe('playWithFallback (autoplay policy)', () => {
  it('plays muted autoplay as is', async () => {
    const { el, calls } = fakeVideo(() => false, true);
    expect(await playWithFallback(el)).toBe('playing');
    expect(calls).toEqual([true]);
  });

  it('keeps sound when the browser allows unmuted play', async () => {
    const { el } = fakeVideo(() => false, false);
    expect(await playWithFallback(el)).toBe('playing');
    expect(el.muted).toBe(false);
  });

  it('falls back to muted playback when unmuted play is refused', async () => {
    const { el, calls } = fakeVideo((m) => !m, false);
    expect(await playWithFallback(el)).toBe('muted');
    expect(el.muted).toBe(true);
    expect(el.paused).toBe(false);
    expect(calls).toEqual([false, true]);
  });

  it('reports blocked (so a play button shows) when even muted play is refused', async () => {
    const { el } = fakeVideo(() => true, false);
    expect(await playWithFallback(el)).toBe('blocked');
    expect(el.paused).toBe(true);
  });

  it('reports blocked when muted autoplay is refused', async () => {
    const { el, calls } = fakeVideo(() => true, true);
    expect(await playWithFallback(el)).toBe('blocked');
    expect(calls).toEqual([true]); // no pointless retry
  });

  it('handles a play() that returns nothing (older browsers)', async () => {
    const el: VideoLike = { muted: true, paused: false, play() {} };
    expect(await playWithFallback(el)).toBe('playing');
  });
});

describe('Discover reel video wiring', () => {
  const reels = read('src/screens/ReelsScreen.tsx');

  it('plays web reels in a plain inline <video>, not expo-video', () => {
    const web = reels.slice(reels.indexOf('function WebReelVideo'));
    const body = web.slice(0, web.indexOf('function NativeReelVideo'));
    expect(body).toMatch(/createElement\('video'/);
    expect(body).toMatch(/playsInline: true/);
    expect(body).toMatch(/muted: true/);
    expect(body).not.toMatch(/useVideoPlayer/);
    expect(reels).toMatch(/isWeb \? <WebReelVideo/);
  });

  it('drives web playback through the lifecycle controller (refused play, off-screen pause)', () => {
    const web = reels.slice(reels.indexOf('function WebReelVideo'));
    const body = web.slice(0, web.indexOf('function NativeReelVideo'));
    expect(body).toMatch(/new ReelPlayback\(/);
    expect(body).toMatch(/reelPlaybackGroup/);
    expect(body).toMatch(/setActive\(active\)/);
    expect(body).toMatch(/watchVisibility\(doc, \(hidden\) => ctl\.setHidden\(hidden\)\)/);
    expect(body).toMatch(/unwatch\(\)/);
    expect(body).toMatch(/ctl\.dispose\(\)/);
    expect(body).toMatch(/label=\{playLabel\}/);
    expect(reels).toMatch(/const reelPlaybackGroup = createPlaybackGroup\(\)/);
  });

  it('reads native audio tracks through nativeAudioPresence, on load and on change', () => {
    const native = reels.slice(reels.indexOf('function NativeReelVideo'));
    const body = native.slice(0, native.indexOf('function Btn'));
    expect(body).toMatch(/addListener\('sourceLoad'/);
    expect(body).toMatch(/addListener\('availableAudioTracksChange'/);
    expect(body).toMatch(/nativeAudioPresence\(/);
    expect(body).toMatch(/platform: Platform\.OS/);
  });

  it('shows the speaker only when the slide on screen has sound', () => {
    expect(reels).toMatch(/\{speaker && \(/);
    expect(reels).toMatch(/showSpeaker\(sound\.sound\)/);
    expect(reels).toMatch(/current\?\.type === 'video'/);
  });

  it('makes the speaker a Mute toggle whose pressed state is the real mute state', () => {
    const speaker = reels.slice(reels.indexOf('{speaker && ('));
    const btn = speaker.slice(0, speaker.indexOf('</Btn>'));
    expect(btn).toMatch(/label=\{t\('reels\.mute'\)\}/);
    expect(btn).toMatch(/pressed=\{muted\}/);
    // No flipping name: "Unmute, not pressed" would contradict the pressed state.
    expect(btn).not.toMatch(/reels\.unmute/);
    // The forced-mute fallback keeps that state truthful.
    expect(reels).toMatch(/onForcedMute\(\)/);
    expect(reels).toMatch(/const forceMuted = useCallback\(\(\) => setMuted\(true\)/);
  });
});

describe('reel sound strings', () => {
  it('has Mute / Play video in English and Telugu', () => {
    for (const k of ['mute', 'playVideo'] as const) {
      expect(en.reels[k]).toBeTruthy();
      expect(te.reels[k]).toBeTruthy();
    }
  });
});

// --- Native (expo-video) audio-track detection ---------------------------------------------

describe('nativeAudioPresence (empty track list is not always "silent")', () => {
  const info = (o: Partial<Parameters<typeof nativeAudioPresence>[0]>) => ({
    platform: 'android',
    loaded: true,
    audioTracks: 0,
    videoTracks: 1,
    ...o,
  });

  it('says "yes" whenever an audio track is listed, on any platform, loaded or not', () => {
    for (const platform of ['android', 'ios']) {
      expect(nativeAudioPresence(info({ platform, audioTracks: 1 }))).toBe('yes');
      expect(nativeAudioPresence(info({ platform, audioTracks: 2, loaded: false }))).toBe('yes');
    }
  });

  it('keeps "unknown" (speaker stays) before the source has loaded', () => {
    expect(nativeAudioPresence(info({ loaded: false }))).toBe('unknown');
    expect(nativeAudioPresence(info({ platform: 'ios', loaded: false }))).toBe('unknown');
  });

  it('confirms silence on Android only after load with the video track read', () => {
    expect(nativeAudioPresence(info({}))).toBe('no');
    // Tracks not read yet (e.g. an empty/cleared track set): not proof of silence.
    expect(nativeAudioPresence(info({ videoTracks: 0 }))).toBe('unknown');
  });

  it('never treats an empty list as silent on iOS (plain MP4s with sound list none)', () => {
    expect(nativeAudioPresence(info({ platform: 'ios' }))).toBe('unknown');
  });

  it('a later "yes" wins over an earlier reading, and "no" survives later unknowns', () => {
    const loading = nativeAudioPresence(info({ loaded: false }));
    const loaded = nativeAudioPresence(info({}));
    expect(mergePresence(loading, loaded)).toBe('no');
    expect(mergePresence('no', nativeAudioPresence(info({ audioTracks: 1 })))).toBe('yes');
    expect(mergePresence('no', nativeAudioPresence(info({ loaded: false })))).toBe('no');
  });
});

// --- Web playback lifecycle (active reel, background tab, one at a time) -------------------

/** A controllable fake `<video>`; with `hold()`, play() results are settled by the test. */
function lifecycleVideo(opts: { muted?: boolean; refuse?: (muted: boolean) => boolean } = {}) {
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  let manual = false;
  const el: PlayableVideo & { plays: number } = {
    muted: opts.muted ?? true,
    paused: true,
    plays: 0,
    play() {
      el.plays++;
      if (manual) {
        return new Promise<void>((resolve, reject) => {
          pending.push({
            resolve: () => {
              el.paused = false;
              resolve();
            },
            reject,
          });
        });
      }
      if (opts.refuse?.(el.muted)) return Promise.reject(notAllowed());
      el.paused = false;
      return Promise.resolve();
    },
    pause() {
      el.paused = true;
    },
  };
  return {
    el,
    pending,
    hold: () => {
      manual = true;
    },
  };
}

function hooks() {
  const h = { forcedMute: 0, stalled: [] as boolean[] };
  return {
    h,
    hooks: {
      onForcedMute: () => {
        h.forcedMute++;
      },
      onStalled: (s: boolean) => {
        h.stalled.push(s);
      },
    },
  };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ReelPlayback: active reel', () => {
  it('plays only when active and pauses when swiped away', async () => {
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup());
    expect(await p.start()).toBeNull(); // not active: no play
    expect(el.plays).toBe(0);
    p.setActive(true);
    await flush();
    expect(el.paused).toBe(false);
    p.setActive(false);
    expect(el.paused).toBe(true);
  });

  it('re-pauses a play() that resolves after the reel was swiped away', async () => {
    const v = lifecycleVideo();
    v.hold();
    const p = new ReelPlayback(v.el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    p.setActive(false);
    v.pending[0].resolve(); // the browser starts it late
    await flush();
    expect(v.el.paused).toBe(true);
  });

  it('re-pauses a late muted retry when swiped away during the unmuted attempt', async () => {
    const v = lifecycleVideo({ muted: false });
    v.hold();
    const { h, hooks: hk } = hooks();
    const p = new ReelPlayback(v.el, hk, createPlaybackGroup());
    p.setActive(true);
    p.setActive(false);
    v.pending[0].reject(notAllowed()); // unmuted refused -> playWithFallback retries muted
    await flush();
    v.pending[1].resolve();
    await flush();
    expect(v.el.paused).toBe(true);
    expect(h.forcedMute).toBe(0); // off screen: no icon change for a reel nobody sees
  });

  it('reports a forced mute when unmuted play is refused, and a stall when all play is', async () => {
    const a = lifecycleVideo({ muted: false, refuse: (m) => !m });
    const ha = hooks();
    new ReelPlayback(a.el, ha.hooks, createPlaybackGroup()).setActive(true);
    await flush();
    expect(ha.h.forcedMute).toBe(1);
    expect(ha.h.stalled.at(-1)).toBe(false);

    const b = lifecycleVideo({ refuse: () => true });
    const hb = hooks();
    new ReelPlayback(b.el, hb.hooks, createPlaybackGroup()).setActive(true);
    await flush();
    expect(hb.h.stalled.at(-1)).toBe(true); // play button shows
  });

  it('never rejects, even if play() throws synchronously', async () => {
    const el: PlayableVideo = {
      muted: true,
      paused: true,
      play() {
        throw new Error('boom');
      },
      pause() {},
    };
    const { h, hooks: hk } = hooks();
    const p = new ReelPlayback(el, hk, createPlaybackGroup());
    p.setActive(true);
    await expect(p.start()).resolves.toBe('blocked');
    expect(h.stalled.at(-1)).toBe(true);
  });
});

describe('ReelPlayback: background tab', () => {
  it('pauses a playing reel when the tab is hidden and resumes it when visible', async () => {
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    await flush();
    p.setHidden(true);
    expect(el.paused).toBe(true);
    p.setHidden(false);
    await flush();
    expect(el.paused).toBe(false);
  });

  it('does not show the play button for its own background pause', async () => {
    const { el } = lifecycleVideo();
    const { h, hooks: hk } = hooks();
    const p = new ReelPlayback(el, hk, createPlaybackGroup());
    p.setActive(true);
    await flush();
    p.setHidden(true);
    p.onPauseEvent(); // the element's 'pause' event for that pause
    expect(h.stalled).not.toContain(true);
  });

  it('keeps a reel paused on return if it was paused before the tab was hidden', async () => {
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    await flush();
    el.pause(); // e.g. the user paused it with OS media controls
    p.setHidden(true);
    p.setHidden(false);
    await flush();
    expect(el.paused).toBe(true);
  });

  it('keeps a blocked reel blocked (play button), not auto-retrying on return', async () => {
    const v = lifecycleVideo({ refuse: () => true });
    const p = new ReelPlayback(v.el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    await flush();
    const plays = v.el.plays;
    p.setHidden(true);
    p.setHidden(false);
    await flush();
    expect(v.el.plays).toBe(plays);
  });

  it('resumes a reel whose play() was still pending when the tab was hidden', async () => {
    const v = lifecycleVideo();
    v.hold();
    const p = new ReelPlayback(v.el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    p.setHidden(true);
    v.pending[0].resolve(); // resolves while hidden: must not keep playing
    await flush();
    expect(v.el.paused).toBe(true);
    p.setHidden(false);
    expect(v.el.plays).toBe(2);
    v.pending[1].resolve();
    await flush();
    expect(v.el.paused).toBe(false);
  });

  it('does not start while hidden; a reel that becomes active then starts on return', async () => {
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup(), true);
    p.setActive(true);
    await flush();
    expect(el.plays).toBe(0);
    p.setHidden(false);
    await flush();
    expect(el.paused).toBe(false);
  });

  it('pauses a play event that happens while hidden', async () => {
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup());
    p.setActive(true);
    await flush();
    p.setHidden(true);
    el.paused = false; // something resumed it in the background
    p.onPlayEvent();
    expect(el.paused).toBe(true);
  });

  it('leaves the mute preference alone across hide / show', async () => {
    const { el } = lifecycleVideo({ muted: false });
    const { h, hooks: hk } = hooks();
    const p = new ReelPlayback(el, hk, createPlaybackGroup());
    p.setActive(true);
    await flush();
    p.setHidden(true);
    p.setHidden(false);
    await flush();
    expect(el.muted).toBe(false);
    expect(h.forcedMute).toBe(0);
  });
});

describe('ReelPlayback: one reel at a time', () => {
  it('pauses the previous reel when another starts', async () => {
    const g = createPlaybackGroup();
    const a = lifecycleVideo();
    const b = lifecycleVideo();
    const pa = new ReelPlayback(a.el, hooks().hooks, g);
    const pb = new ReelPlayback(b.el, hooks().hooks, g);
    pa.setActive(true);
    await flush();
    pb.setActive(true); // e.g. both briefly "active" during a fast swipe
    await flush();
    expect(a.el.paused).toBe(true);
    expect(b.el.paused).toBe(false);
    expect(g.owner()).toBe(pb);
  });

  it('a disposed reel releases the group and stops', async () => {
    const g = createPlaybackGroup();
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, g);
    p.setActive(true);
    await flush();
    p.dispose();
    expect(el.paused).toBe(true);
    expect(g.owner()).toBeNull();
    p.setActive(true);
    expect(await p.start()).toBeNull();
  });
});

describe('tab visibility helpers', () => {
  function fakeDoc(initial: 'visible' | 'hidden') {
    const fns = new Set<() => void>();
    let state = initial;
    const doc = {
      get visibilityState() {
        return state;
      },
      addEventListener: (_t: 'visibilitychange', fn: () => void) => {
        fns.add(fn);
      },
      removeEventListener: (_t: 'visibilitychange', fn: () => void) => {
        fns.delete(fn);
      },
      set(s: 'visible' | 'hidden') {
        state = s;
        for (const fn of fns) fn();
      },
      count: () => fns.size,
    };
    return doc satisfies VisibilitySource;
  }

  it('reads visibilityState, falls back to hidden, and is visible with no document', () => {
    expect(isHidden(fakeDoc('hidden'))).toBe(true);
    expect(isHidden(fakeDoc('visible'))).toBe(false);
    expect(isHidden({ hidden: true, addEventListener() {}, removeEventListener() {} })).toBe(true);
    expect(isHidden(null)).toBe(false);
  });

  it('reports changes and unsubscribes', () => {
    const doc = fakeDoc('visible');
    const seen: boolean[] = [];
    const off = watchVisibility(doc, (h) => seen.push(h));
    doc.set('hidden');
    doc.set('visible');
    off();
    doc.set('hidden');
    expect(seen).toEqual([true, false]);
    expect(doc.count()).toBe(0);
    expect(watchVisibility(null, () => {})).toBeTypeOf('function');
  });

  it('drives a reel end to end through visibilitychange', async () => {
    const doc = fakeDoc('visible');
    const { el } = lifecycleVideo();
    const p = new ReelPlayback(el, hooks().hooks, createPlaybackGroup(), isHidden(doc));
    const off = watchVisibility(doc, (h) => p.setHidden(h));
    p.setActive(true);
    await flush();
    doc.set('hidden');
    expect(el.paused).toBe(true);
    doc.set('visible');
    await flush();
    expect(el.paused).toBe(false);
    off();
  });
});
