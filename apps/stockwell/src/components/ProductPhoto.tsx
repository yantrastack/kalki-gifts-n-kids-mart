'use client';
import { useState } from 'react';
import { useI18n } from '@/i18n';

// A product's photo that fills its parent, or the initials when there is no photo or it
// fails to load. Put it inside a sized box (`.product-thumb`, `.img-placeholder`, …) so the
// layout never shifts; `size` is only the intrinsic width/height hint for the <img>.
export default function ProductPhoto({
  src,
  name,
  size = 160,
}: {
  src?: string | null;
  name: string;
  size?: number;
}) {
  const { t } = useI18n();
  // Remember which URL failed, so a new photo for the same product gets a fresh try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (src && src !== failedSrc)
    return (
      <img
        src={src}
        alt={t('media.photoOf', { name })}
        width={size}
        height={size}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setFailedSrc(src)}
      />
    );
  return (
    <span>
      {(name || '?')
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()}
    </span>
  );
}
