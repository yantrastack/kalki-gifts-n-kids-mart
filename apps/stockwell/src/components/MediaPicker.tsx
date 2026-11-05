'use client';
import { useEffect, useState } from 'react';
import { photoCount } from '@stockwell/shared';
import { useI18n } from '@/i18n';
import { declaredType, limitMedia, moveWithinKind } from '@/lib/mediaRules';
import { MediaSections, problemMessage, screenFiles, type UploadEntry } from './ProductMediaGrid';
import MediaPreview from './MediaPreview';

// Photo/video chooser for a product that doesn't exist yet: the files are held here and
// uploaded by the caller once the product has an id. Files are checked with the same
// rules as POST /api/products/[id]/media (format, size, resolution) and kept in the
// order shown; the first photo is the cover. Photos and videos have their own sections,
// and a video can be played with sound before saving (local object URL). YAN-108/109.

const kindOf = (f: File): 'image' | 'video' =>
  declaredType(f)?.startsWith('video/') ? 'video' : 'image';

/** Photos (not videos) among the chosen files. */
export const filePhotoCount = (files: File[]) =>
  photoCount(files.map((f) => ({ type: kindOf(f) })));

export default function MediaPicker({
  files,
  onChange,
  disabled,
  uploads = [],
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  /** Progress of the upload that runs after the product is created. */
  uploads?: UploadEntry[];
}) {
  const { t } = useI18n();
  const [errors, setErrors] = useState<Partial<Record<'image' | 'video', string[]>>>({});
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

  const add = async (kind: 'image' | 'video', list: File[]) => {
    setChecking(true);
    try {
      const screened = await screenFiles(list);
      let { accepted } = screened;
      const problems = [...screened.problems];
      const lim = limitMedia(kind, files.filter((f) => kindOf(f) === kind).length, accepted);
      accepted = lim.accepted;
      problems.push(...lim.problems);
      setErrors((e) => ({ ...e, [kind]: problems.map((p) => problemMessage(t, p)) }));
      if (accepted.length) onChange([...files, ...accepted]);
    } finally {
      setChecking(false);
    }
  };

  const label = (i: number) => {
    const kind = kindOf(files[i]);
    const n = files.slice(0, i + 1).filter((x) => kindOf(x) === kind).length;
    return kind === 'video' ? t('media.videoN', { n }) : t('media.photoN', { n });
  };

  return (
    <div className="dp-section" style={{ margin: 0 }}>
      <h4>{t('media.title')}</h4>
      <MediaSections
        items={files.map((f, i) => ({
          key: `${f.name}-${f.size}-${f.lastModified}-${i}`,
          url: urls[i] ?? '',
          type: kindOf(f),
          name: f.name,
        }))}
        errors={errors}
        disabled={disabled || checking}
        onAdd={add}
        uploads={uploads}
        onMove={(kind, from, to) =>
          onChange(
            moveWithinKind(
              files.map((f) => ({ f, type: kindOf(f) })),
              kind,
              from,
              to,
            ).map((x) => x.f),
          )
        }
        onRemove={(i) => onChange(files.filter((_, j) => j !== i))}
        onPreview={(i) => {
          if (files[i] && urls[i])
            setPreview({ url: urls[i], type: kindOf(files[i]), label: label(i) });
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
