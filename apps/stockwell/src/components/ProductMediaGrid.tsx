'use client';
import { useId, useRef, useState } from 'react';
import { MIN_PHOTO_SIDE, MIN_PRODUCT_PHOTOS } from '@stockwell/shared';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';
import {
  MAX_PHOTO_BYTES,
  maxFor,
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

export type GridItem = {
  key: string;
  url: string;
  type: 'image' | 'video';
  name?: string;
  poster?: string | null;
  durationS?: number | null;
  hasAudio?: boolean | null;
};

/** 75.4 → "1:15". */
export const clock = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

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
  showCover = true,
  showKind = true,
}: {
  items: GridItem[];
  onMove: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onPreview?: (index: number) => void;
  onReplace?: (index: number, file: File) => void;
  disabled?: boolean;
  canEdit?: boolean;
  /** Mark the first tile as the cover and offer "Set as cover" (photos only). */
  showCover?: boolean;
  /** Show the "Video" badge (only needed when photos and videos are mixed). */
  showKind?: boolean;
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
              border: `${showCover && i === 0 ? 2 : 1}px solid ${
                dragOver === i
                  ? 'var(--accent)'
                  : showCover && i === 0
                    ? 'var(--accent)'
                    : 'var(--border)'
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
                    poster={m.poster || undefined}
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
            {showCover && i === 0 && (
              <span
                className="badge badge-accent"
                style={{ position: 'absolute', top: 6, left: 6 }}
              >
                <Icon name="star" size={10} /> {t('media.cover')}
              </span>
            )}
            {m.type === 'video' && (showKind || m.durationS || m.hasAudio === false) && (
              <span
                style={{
                  position: 'absolute',
                  top: showCover && i === 0 ? 30 : 6,
                  left: 6,
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                }}
              >
                {showKind && <span className="badge">{t('media.video')}</span>}
                {m.durationS ? <span className="badge">{clock(m.durationS)}</span> : null}
                {m.hasAudio === false && (
                  <span className="badge badge-warn">{t('media.noSound')}</span>
                )}
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
                {showCover && i > 0 && (
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

/* ---------------------------------------------------------------- YAN-108 sections */

/**
 * One file's upload state (progress list). A failed file keeps its File handle so it can
 * be retried without picking it again.
 */
export type UploadEntry = {
  key: string;
  name: string;
  kind: 'image' | 'video';
  percent: number; // 0–100
  status: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
  file?: File;
  replaceId?: string; // set when this entry replaces an existing media item
};

/** Per-file progress, with Retry / Dismiss for a failed file when handlers are given. */
export function UploadList({
  uploads,
  onRetry,
  onDismiss,
}: {
  uploads: UploadEntry[];
  onRetry?: (u: UploadEntry) => void;
  onDismiss?: (u: UploadEntry) => void;
}) {
  const { t } = useI18n();
  const shown = uploads.filter((u) => u.status !== 'done');
  if (!shown.length) return null;
  return (
    <ul
      aria-live="polite"
      style={{ marginTop: 10, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}
    >
      {shown.map((u) => (
        <li
          key={u.key}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}
        >
          <span
            style={{
              flex: '1 1 120px',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {u.name}
          </span>
          {u.status === 'waiting' && <span className="muted tiny">{t('media.waiting')}</span>}
          {u.status === 'uploading' && (
            <>
              <progress
                value={u.percent}
                max={100}
                style={{ width: 120 }}
                aria-label={`${t('media.uploading')} ${u.name}`}
              />
              <span className="muted tiny">{u.percent}%</span>
            </>
          )}
          {u.status === 'error' && (
            <>
              <span className="field-error tiny" role="alert" style={{ margin: 0 }}>
                {u.error}
              </span>
              {onRetry && u.file && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onRetry(u)}
                >
                  <Icon name="refresh" size={11} /> {t('media.retry')}
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`${t('media.dismiss')}: ${u.name}`}
                  title={t('media.dismiss')}
                  onClick={() => onDismiss(u)}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

type Kind = 'image' | 'video';

type SectionProps = {
  items: GridItem[];
  onAdd?: (kind: Kind, files: File[]) => void;
  onMove: (kind: Kind, from: number, to: number) => void;
  onRemove?: (index: number) => void;
  onPreview?: (index: number) => void;
  onReplace?: (index: number, file: File) => void;
  errors?: Partial<Record<Kind, string[]>>;
  uploads?: UploadEntry[];
  onRetry?: (u: UploadEntry) => void;
  onDismiss?: (u: UploadEntry) => void;
  disabled?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
};

/**
 * The product media manager body: a Photos section and a Videos section, each with its
 * own picker (accept limited to that type), limits text, progress and tiles. `items` is
 * the saved/chosen media in its overall order; the callbacks get indexes into `items`
 * (remove/preview/replace) or positions within one section (move). Used by the Add
 * product popup and the product Media tab. YAN-108.
 */
export function MediaSections(props: SectionProps) {
  return (
    <div style={{ display: 'grid', gap: 22 }}>
      <MediaSection kind="image" {...props} />
      <MediaSection kind="video" {...props} />
    </div>
  );
}

function MediaSection({
  kind,
  items,
  onAdd,
  onMove,
  onRemove,
  onPreview,
  onReplace,
  errors = {},
  uploads = [],
  onRetry,
  onDismiss,
  disabled = false,
  canAdd = true,
  canEdit = true,
}: SectionProps & { kind: Kind }) {
  const { t } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isPhoto = kind === 'image';
  const sectionErrors = errors[kind] ?? [];
  // Overall indexes of this section's items, in order.
  const slots: number[] = [];
  items.forEach((m, i) => {
    if (m.type === kind) slots.push(i);
  });
  const at = (sectionIndex: number) => slots[sectionIndex];
  // Photos/videos already at the cap (counting files still uploading): no more can be added.
  const pending = uploads.filter(
    (u) => u.kind === kind && u.status !== 'done' && u.status !== 'error',
  ).length;
  const atLimit = slots.length + pending >= maxFor(kind);

  return (
    <section aria-labelledby={`${id}-title`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h5 id={`${id}-title`} style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          {isPhoto ? t('media.photosTitle') : t('media.videosTitle')}{' '}
          <span className="muted" style={{ fontWeight: 400 }}>
            ({slots.length})
          </span>
        </h5>
        {canAdd && onAdd && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={isPhoto ? PHOTO_ACCEPT : VIDEO_ACCEPT}
              style={{ display: 'none' }}
              tabIndex={-1}
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (list.length) onAdd(kind, list);
              }}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto' }}
              disabled={disabled || atLimit}
              title={
                atLimit
                  ? t(isPhoto ? 'media.problem.tooManyPhotos' : 'media.problem.tooManyVideos', {
                      name: '',
                      max: maxFor(kind),
                    }).replace(/^:\s*/, '')
                  : undefined
              }
              onClick={() => inputRef.current?.click()}
            >
              <Icon name="plus" size={12} /> {isPhoto ? t('media.addPhotos') : t('media.addVideos')}
            </button>
          </>
        )}
      </div>
      <p className="muted tiny" style={{ margin: '6px 0 0' }}>
        {isPhoto
          ? t('media.photosHelp', {
              min: MIN_PHOTO_SIDE,
              mb: MAX_PHOTO_BYTES >> 20,
              max: maxFor(kind),
            })
          : t('media.videosHelp', { mb: MAX_VIDEO_BYTES >> 20, max: maxFor(kind) })}
      </p>
      {sectionErrors.length > 0 && (
        <ul className="field-error" role="alert" style={{ marginTop: 8, paddingLeft: 16 }}>
          {sectionErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <UploadList
        uploads={uploads.filter((u) => u.kind === kind)}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
      {isPhoto && <PhotoCount photos={slots.length} />}
      {slots.length ? (
        <ProductMediaGrid
          items={slots.map((i) => items[i])}
          disabled={disabled}
          canEdit={canEdit}
          showCover={isPhoto}
          showKind={false}
          onMove={(from, to) => onMove(kind, from, to)}
          onRemove={onRemove ? (i) => onRemove(at(i)) : undefined}
          onPreview={onPreview ? (i) => onPreview(at(i)) : undefined}
          onReplace={onReplace ? (i, f) => onReplace(at(i), f) : undefined}
        />
      ) : (
        <p className="muted tiny" style={{ padding: '12px 0 0', margin: 0 }}>
          {isPhoto ? t('media.noPhotos') : t('media.noVideos')}
        </p>
      )}
    </section>
  );
}
