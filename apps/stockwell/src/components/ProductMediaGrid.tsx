'use client';
import { useRef, useState } from 'react';
import { MIN_PHOTO_SIDE, MIN_PRODUCT_PHOTOS } from '@stockwell/shared';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';
import {
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  PHOTO_ACCEPT,
  VIDEO_ACCEPT,
  checkMediaFile,
  declaredType,
  type MediaProblem,
} from '@/lib/mediaRules';

/*
 * Product photo/video manager pieces shared by the Add product popup (files not uploaded
 * yet) and the product Media tab (saved media). YAN-109.
 */

export type GridItem = { key: string; url: string; type: 'image' | 'video'; name?: string };

type T = (k: string, p?: Record<string, any>) => string;

/** Translated message for a file the upload rules reject. */
export const problemMessage = (t: T, p: MediaProblem): string => t(`media.problem.${p.code}`, p);

/**
 * Same checks as POST /api/products/[id]/media, run in the browser before uploading:
 * format, size per type, real image bytes and minimum resolution.
 */
export async function screenFiles(
  files: File[],
): Promise<{ accepted: File[]; problems: MediaProblem[] }> {
  const accepted: File[] = [];
  const problems: MediaProblem[] = [];
  for (const f of files) {
    const isVideo = declaredType(f)?.startsWith('video/') ?? false;
    // Only read photos that pass the size limit, so a huge file isn't loaded for nothing.
    const bytes =
      isVideo || f.size > MAX_PHOTO_BYTES ? null : new Uint8Array(await f.arrayBuffer());
    const res = checkMediaFile(f, bytes);
    if (res.ok) accepted.push(f);
    else if (res.problem) problems.push(res.problem);
  }
  return { accepted, problems };
}

/** Help text under the section title, with the current limits filled in. */
export function MediaHelp() {
  const { t } = useI18n();
  return (
    <p className="muted tiny" style={{ marginBottom: 12 }}>
      {t('media.help', {
        min: MIN_PHOTO_SIDE,
        photoMb: MAX_PHOTO_BYTES >> 20,
        videoMb: MAX_VIDEO_BYTES >> 20,
      })}
    </p>
  );
}

/** "Photos: n / 3 minimum", plus how many more are needed to publish. */
export function PhotoCount({ photos }: { photos: number }) {
  const { t } = useI18n();
  const short = Math.max(0, MIN_PRODUCT_PHOTOS - photos);
  return (
    <div
      role="status"
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}
    >
      <span className={`badge ${short ? 'badge-warn' : 'badge-success'}`}>
        {t('media.photoCount', { n: photos, min: MIN_PRODUCT_PHOTOS })}
      </span>
      <span className="muted tiny">
        {short ? t('media.needMore', { count: short }) : t('media.enough')}
      </span>
    </div>
  );
}

/**
 * Media tiles in their saved order. The first tile is the cover. Reorder by dragging a
 * tile, or with the ← / → buttons (keyboard and touch); "Set as cover" moves a tile to the
 * front. `onMove(from, to)` gets the indexes; the parent saves the new order.
 * `onPreview(index)` opens a play-with-sound preview; `onReplace(index)` swaps the file in
 * place. Both are optional — pass them only where they make sense.
 */
export function ProductMediaGrid({
  items,
  onMove,
  onRemove,
  onPreview,
  onReplace,
  disabled = false,
  canEdit = true,
}: {
  items: GridItem[];
  onMove: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onPreview?: (index: number) => void;
  onReplace?: (index: number, file: File) => void;
  disabled?: boolean;
  canEdit?: boolean;
}) {
  const { t } = useI18n();
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const replaceRef = useRef<{ index: number; input: HTMLInputElement } | null>(null);
  if (!items.length) return null;

  // Numbered per kind ("Photo 2", "Video 1") for button labels and alt text.
  let photos = 0;
  let videos = 0;
  const labels = items.map((m) =>
    m.type === 'video' ? t('media.videoN', { n: ++videos }) : t('media.photoN', { n: ++photos }),
  );
  const editable = canEdit && !disabled && items.length > 1;

  return (
    <ul
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 10,
        marginTop: 14,
        padding: 0,
        listStyle: 'none',
      }}
    >
      {items.map((m, i) => {
        const label = labels[i];
        const bad = failed.has(m.key);
        return (
          <li
            key={m.key}
            draggable={editable}
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (dragFrom == null) return;
              e.preventDefault();
              setDragOver(i);
            }}
            onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom != null && dragFrom !== i) onMove(dragFrom, i);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            style={{
              position: 'relative',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              border: `${i === 0 ? 2 : 1}px solid ${
                dragOver === i ? 'var(--accent)' : i === 0 ? 'var(--accent)' : 'var(--border)'
              }`,
              background: 'var(--bg-muted)',
              aspectRatio: '1',
              cursor: editable ? 'grab' : undefined,
              opacity: dragFrom === i ? 0.5 : 1,
            }}
          >
            {!m.url ? null : bad ? (
              <div
                className="muted tiny"
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  padding: 8,
                }}
              >
                {m.type === 'video' ? t('media.videoUnavailable') : t('media.unavailable')}
              </div>
            ) : m.type === 'video' ? (
              onPreview ? (
                <button
                  type="button"
                  aria-label={`${t('media.preview')}: ${label}`}
                  title={`${t('media.preview')}: ${label}`}
                  onClick={() => onPreview(i)}
                  style={{
                    padding: 0,
                    border: 0,
                    width: '100%',
                    height: '100%',
                    cursor: 'pointer',
                    position: 'relative',
                    background: '#000',
                  }}
                >
                  <video
                    src={m.url}
                    muted
                    playsInline
                    preload="metadata"
                    aria-hidden
                    onError={() => setFailed((s) => new Set(s).add(m.key))}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      background: 'rgba(0,0,0,0.25)',
                    }}
                  >
                    <Icon name="play" size={28} />
                  </span>
                </button>
              ) : (
                <video
                  src={m.url}
                  muted
                  playsInline
                  aria-label={label}
                  onError={() => setFailed((s) => new Set(s).add(m.key))}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )
            ) : (
              <img
                src={m.url}
                alt={m.name ? `${label}: ${m.name}` : label}
                draggable={false}
                onError={() => setFailed((s) => new Set(s).add(m.key))}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {i === 0 && (
              <span
                className="badge badge-accent"
                style={{ position: 'absolute', top: 6, left: 6 }}
              >
                <Icon name="star" size={10} /> {t('media.cover')}
              </span>
            )}
            {m.type === 'video' && (
              <span
                className="badge"
                style={{ position: 'absolute', top: i === 0 ? 30 : 6, left: 6 }}
              >
                {t('media.video')}
              </span>
            )}
            {onRemove && (
              <TileButton
                icon="trash"
                label={`${t('media.remove')}: ${label}`}
                disabled={disabled}
                onClick={() => onRemove(i)}
                style={{ top: 4, right: 4 }}
              />
            )}
            {onReplace && canEdit && (
              <>
                <TileButton
                  icon="refresh"
                  label={`${t('media.replace')}: ${label}`}
                  disabled={disabled}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = m.type === 'video' ? VIDEO_ACCEPT : PHOTO_ACCEPT;
                    input.onchange = () => {
                      const f = input.files?.[0];
                      if (f) onReplace(i, f);
                    };
                    replaceRef.current = { index: i, input };
                    input.click();
                  }}
                  style={{ top: 4, right: onRemove ? 34 : 4 }}
                />
              </>
            )}
            {editable && (
              <div
                style={{
                  position: 'absolute',
                  left: 4,
                  right: 4,
                  bottom: 4,
                  display: 'flex',
                  gap: 4,
                  justifyContent: 'space-between',
                }}
              >
                <TileButton
                  icon="chevLeft"
                  label={`${t('media.moveEarlier')}: ${label}`}
                  disabled={i === 0}
                  onClick={() => onMove(i, i - 1)}
                />
                {i > 0 && (
                  <TileButton
                    icon="star"
                    label={`${t('media.setCover')}: ${label}`}
                    onClick={() => onMove(i, 0)}
                  />
                )}
                <TileButton
                  icon="chevRight"
                  label={`${t('media.moveLater')}: ${label}`}
                  disabled={i === items.length - 1}
                  onClick={() => onMove(i, i + 1)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TileButton({
  icon,
  label,
  onClick,
  disabled,
  style,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: style?.top != null ? 'absolute' : undefined,
        width: 26,
        height: 26,
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <Icon name={icon} size={12} />
    </button>
  );
}
