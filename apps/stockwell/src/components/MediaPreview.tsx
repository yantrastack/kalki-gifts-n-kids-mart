'use client';
import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';

/**
 * Play-with-sound preview for one media item (YAN-108). Videos play with native controls
 * and audio on; images show full-size. Used by the Media tab (saved media) and the Add
 * product popup (local object URLs, so an admin can check a video before saving).
 */
export default function MediaPreview({
  url,
  type,
  label,
  onClose,
}: {
  url: string;
  type: 'image' | 'video';
  label: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Autoplay with sound is allowed here because opening the preview is a user gesture.
  useEffect(() => {
    if (type === 'video') videoRef.current?.play().catch(() => {});
  }, [type]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <button
        type="button"
        className="icon-btn"
        aria-label={t('media.closePreview')}
        title={t('media.closePreview')}
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          zIndex: 1,
        }}
      >
        <Icon name="x" size={16} />
      </button>
      {type === 'video' ? (
        // biome-ignore lint/a11y/useMediaCaption: admins preview their own uploaded product videos; no caption track exists for user uploads
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 'var(--r-md)' }}
        />
      ) : (
        <img
          src={url}
          alt={label}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 'var(--r-md)',
          }}
        />
      )}
    </div>
  );
}
