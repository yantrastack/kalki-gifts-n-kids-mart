'use client';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';

// A product's photos and videos as a swipeable carousel (scroll-snap) with arrows and dots —
// the admin counterpart of the storefront's MediaCarousel. Videos play in place with native
// controls. With no media, or an item that fails to load, it shows the initials placeholder,
// so cards never change size.
//
// The layout that makes it work (flex track, snap slides, positioned arrows) is inline on
// purpose: it must not depend on a stylesheet, or a stale one would stack the slides.
const FRAME: CSSProperties = { aspectRatio: 1, marginBottom: 10, position: 'relative' };
const TRACK: CSSProperties = {
  display: 'flex',
  width: '100%',
  height: '100%',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  scrollbarWidth: 'none',
};
const SLIDE: CSSProperties = {
  flex: '0 0 100%',
  height: '100%',
  scrollSnapAlign: 'center',
  position: 'relative',
};
const IMG: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const VIDEO: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
  background: '#000',
};
const NAV: CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 26,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  background: 'var(--bg-elev)',
  border: '1px solid var(--border)',
  color: 'var(--fg)',
  padding: 0,
};
const DOTS: CSSProperties = {
  position: 'absolute',
  bottom: 6,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  gap: 5,
  pointerEvents: 'none', // only the dots themselves take clicks, not the strip around them
};

export type CarouselItem = { type: string; url: string; poster?: string | null };

export default function ProductCarousel({
  photos,
  media,
  name,
}: {
  photos: string[];
  media?: CarouselItem[]; // photos and videos in media order; falls back to `photos`
  name: string;
}) {
  const { t } = useI18n();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const slides: CarouselItem[] = media?.length
    ? media
    : photos.map((url) => ({ type: 'image', url }));
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (!slides.length)
    return (
      <div className="img-placeholder" style={FRAME}>
        <span>{initials}</span>
      </div>
    );

  // "Photo 2 of 3" / "Video 1 of 1": counted within each kind, the way the Media tab numbers them.
  const labelFor = (i: number) => {
    const kind = slides[i].type === 'video' ? 'video' : 'image';
    const same = slides.filter((s) => (s.type === 'video' ? 'video' : 'image') === kind);
    const n = slides
      .slice(0, i + 1)
      .filter((s) => (s.type === 'video') === (kind === 'video')).length;
    return `${t(kind === 'video' ? 'media.videoN' : 'media.photoN', { n })} / ${same.length}`;
  };
  // Only the slide in view may play: pause the others when the carousel moves on.
  const settle = (i: number) => {
    setIndex(i);
    Array.from(track.current?.children ?? []).forEach((slide, k) => {
      if (k !== i) slide.querySelector('video')?.pause();
    });
  };
  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const next = Math.max(0, Math.min(slides.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    settle(next);
  };
  // Buttons sit on top of a clickable card; don't let their clicks open the product.
  const press = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const many = slides.length > 1;

  return (
    <div
      className="product-carousel"
      style={{
        ...FRAME,
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        background: 'var(--bg-muted)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        ref={track}
        className="product-carousel-track"
        style={TRACK}
        onScroll={(e) => {
          const el = e.currentTarget;
          settle(Math.round(el.scrollLeft / (el.clientWidth || 1)));
        }}
      >
        {slides.map((s, i) => (
          <div key={`${s.url}-${i}`} style={SLIDE}>
            {failed.has(s.url) ? (
              <div className="img-placeholder" style={{ width: '100%', height: '100%' }}>
                <span>{initials}</span>
              </div>
            ) : s.type === 'video' ? (
              <>
                {/* biome-ignore lint/a11y/useMediaCaption: admins preview their own uploaded product videos; no caption track exists for user uploads */}
                <video
                  // Without a poster, "#t=0.1" makes the browser draw an early frame instead of black.
                  src={s.poster ? s.url : `${s.url}#t=0.1`}
                  poster={s.poster ?? undefined}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t('media.videoOf', { name })}
                  style={VIDEO}
                  onClick={(e) => e.stopPropagation()} // playing must not open the product
                  onError={() => setFailed((f) => new Set(f).add(s.url))}
                />
                <span className="badge" style={{ position: 'absolute', top: 6, left: 6 }}>
                  {t('media.video')}
                </span>
              </>
            ) : (
              <img
                src={s.url}
                alt={`${t('media.photoOf', { name })} (${labelFor(i)})`}
                width={400}
                height={400}
                style={IMG}
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={() => setFailed((f) => new Set(f).add(s.url))}
              />
            )}
          </div>
        ))}
      </div>
      {many && (
        <>
          <button
            type="button"
            style={{ ...NAV, left: 6, opacity: index === 0 ? 0.4 : 0.95 }}
            aria-label={t('media.prevPhoto')}
            disabled={index === 0}
            onClick={press(() => goTo(index - 1))}
          >
            <Icon name="chevLeft" size={14} />
          </button>
          <button
            type="button"
            style={{ ...NAV, right: 6, opacity: index === slides.length - 1 ? 0.4 : 0.95 }}
            aria-label={t('media.nextPhoto')}
            disabled={index === slides.length - 1}
            onClick={press(() => goTo(index + 1))}
          >
            <Icon name="chevRight" size={14} />
          </button>
          <div style={{ ...DOTS, bottom: slides[index]?.type === 'video' ? 46 : 6 }}>
            {slides.map((s, i) => (
              <button
                type="button"
                key={`${s.url}-${i}`}
                style={{
                  width: 6,
                  height: 6,
                  padding: 0,
                  borderRadius: '50%',
                  background: i === index ? '#fff' : 'rgba(255, 255, 255, 0.6)',
                  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.25)',
                  pointerEvents: 'auto',
                }}
                aria-label={labelFor(i)}
                aria-current={i === index}
                onClick={press(() => goTo(i))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
