'use client';
import { useEffect, useRef, useState } from 'react';
import { photoCount } from '@stockwell/shared';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';
import { UPLOAD_ACCEPT, declaredType, moveItem } from '@/lib/mediaRules';
import {
  MediaHelp,
  PhotoCount,
  ProductMediaGrid,
  problemMessage,
  screenFiles,
} from './ProductMediaGrid';
import MediaPreview from './MediaPreview';

// Photo/video chooser for a product that doesn't exist yet: the files are held here and
// uploaded by the caller once the product has an id. Files are checked with the same
// rules as POST /api/products/[id]/media (format, size, resolution) and kept in the
// order shown; the first photo is the cover.

const kindOf = (f: File): 'image' | 'video' =>
  declaredType(f)?.startsWith('video/') ? 'video' : 'image';

/** Photos (not videos) among the chosen files. */
export const filePhotoCount = (files: File[]) =>
  photoCount(files.map((f) => ({ type: kindOf(f) })));

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
  const [errors, setErrors] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [urls, setUrls] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    url: string;
    type: 'image' | 'video';
    label: string;
  } | null>(null);

  useEffect(() => {
    const made = files.map((f) => URL.createObjectURL(f));
    setUrls(made);
    return () => {
      for (const u of made) URL.revokeObjectURL(u);
    };
  }, [files]);

  const add = async (picked: FileList | null) => {
    if (!picked?.length) return;
    const list = Array.from(picked);
    if (inputRef.current) inputRef.current.value = '';
    setChecking(true);
    try {
      const { accepted, problems } = await screenFiles(list);
      setErrors(problems.map((p) => problemMessage(t, p)));
      if (accepted.length) onChange([...files, ...accepted]);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="dp-section" style={{ margin: 0 }}>
      <h4>{t('media.title')}</h4>
      <MediaHelp />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => add(e.target.files)}
      />
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={disabled || checking}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="plus" size={12} /> {t('media.add')}
      </button>
      {errors.length > 0 && (
        <ul className="field-error" role="alert" style={{ marginTop: 8, paddingLeft: 16 }}>
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <PhotoCount photos={filePhotoCount(files)} />
      <ProductMediaGrid
        items={files.map((f, i) => ({
          key: `${f.name}-${f.size}-${f.lastModified}-${i}`,
          url: urls[i] ?? '',
          type: kindOf(f),
          name: f.name,
        }))}
        disabled={disabled}
        onMove={(from, to) => onChange(moveItem(files, from, to))}
        onRemove={(i) => onChange(files.filter((_, j) => j !== i))}
        onPreview={(i) => {
          const f = files[i];
          if (f && urls[i])
            setPreview({
              url: urls[i],
              type: kindOf(f),
              label:
                kindOf(f) === 'video'
                  ? t('media.videoN', {
                      n: files.slice(0, i + 1).filter((x) => kindOf(x) === 'video').length,
                    })
                  : t('media.photoN', {
                      n: files.slice(0, i + 1).filter((x) => kindOf(x) === 'image').length,
                    }),
            });
        }}
      />
      {preview && (
        <MediaPreview
          url={preview.url}
          type={preview.type}
          label={preview.label}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
