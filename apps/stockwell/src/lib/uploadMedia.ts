'use client';
/*
 * Browser upload helpers for product media (YAN-108). One XHR per file so each file
 * reports its own progress and fails on its own — a bad file never loses the others.
 */

export type UploadProgress = (loaded: number, total: number) => void;

/** Error thrown for a refused upload; `problem` is the API's structured reason, if any. */
export class MediaUploadError extends Error {
  problem?: unknown;
  constructor(message: string, problem?: unknown) {
    super(message);
    this.problem = problem;
  }
}

function send(
  url: string,
  method: 'POST' | 'PUT',
  fields: Record<string, File>,
  onProgress?: UploadProgress,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded, e.total);
    };
    xhr.onload = () => {
      let body: any = {};
      try {
        body = JSON.parse(xhr.responseText || '{}');
      } catch {
        /* non-JSON error page */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else
        reject(new MediaUploadError(body.error || `Upload failed (${xhr.status})`, body.problem));
    };
    xhr.onerror = () => reject(new MediaUploadError('Network error during upload'));
    xhr.onabort = () => reject(new MediaUploadError('Upload cancelled'));
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    xhr.send(fd);
  });
}

/** Upload one file to a product's media. `onProgress(loaded, total)` fires as bytes go. */
export function uploadMediaFile(
  productId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<any> {
  return send(`/api/products/${productId}/media`, 'POST', { files: file }, onProgress);
}

/** Replace one media item in place; keeps its position and cover status. */
export function replaceMediaFile(
  productId: string,
  mediaId: string,
  file: File,
  onProgress?: UploadProgress,
): Promise<any> {
  return send(`/api/products/${productId}/media/${mediaId}`, 'PUT', { file }, onProgress);
}
