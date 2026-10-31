'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';

// Photo/video chooser for a product that doesn't exist yet: the files are held here and
// uploaded by the caller once the product has an id. Limits mirror
// POST /api/products/[id]/media (same types, 50 MB each).

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm';
const TYPES = new Set(ACCEPT.split(','));
const EXT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

// Some browsers report videos as octet-stream, so fall back to the file extension.
const typeOf = (f: File): string | null => {
  if (TYPES.has(f.type)) return f.type;
  const dot = f.name.lastIndexOf('.');
  return dot >= 0 ? (EXT_TYPES[f.name.slice(dot).toLowerCase()] ?? null) : null;
};
const isVideo = (f: File) => typeOf(f)?.startsWith('video/') ?? false;

export default function MediaPicker({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const made = files.map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => {
      for (const u of made) URL.revokeObjectURL(u);
    };
  }, [files]);

  const add = (picked: FileList | null) => {
    if (!picked?.length) return;
    const accepted: File[] = [];
    let message = '';
    for (const f of Array.from(picked)) {
      if (!typeOf(f)) message = t('productForm.unsupportedFile', { name: f.name });
      else if (f.size > MAX_FILE_SIZE) message = t('productForm.fileTooLarge', { name: f.name });
      else accepted.push(f);
    }
    setError(message);
    if (accepted.length) onChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="dp-section" style={{ margin: 0 }}>
      <h4>{t('productForm.mediaTitle')}</h4>
      <p className="muted tiny" style={{ marginBottom: 12 }}>
        {t('productForm.mediaHelp')}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="plus" size={12} /> {t('productForm.addFiles')}
      </button>
      {error && (
        <div className="field-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </div>
      )}
      {files.length > 0 && (
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}
        >
          {files.map((f, i) => (
            <div
              key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
              style={{
                position: 'relative',
                borderRadius: 'var(--r-md)',
                overflow: 'hidden',
                border: '1px solid var(--border)',
                background: 'var(--bg-muted)',
                aspectRatio: '1',
              }}
            >
              {urls[i] &&
                (isVideo(f) ? (
                  <video
                    src={urls[i]}
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <img
                    src={urls[i]}
                    alt={f.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ))}
              {i === 0 && (
                <span
                  className="badge badge-accent"
                  style={{ position: 'absolute', top: 6, left: 6 }}
                >
                  {t('productForm.cover')}
                </span>
              )}
              {isVideo(f) && (
                <span className="badge" style={{ position: 'absolute', bottom: 6, left: 6 }}>
                  {t('productForm.video')}
                </span>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={t('productForm.removeFile')}
                title={t('productForm.removeFile')}
                disabled={disabled}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
