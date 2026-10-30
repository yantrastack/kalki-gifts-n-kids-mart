import { createReadStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import type { NextRequest } from 'next/server';
import { EXT_TO_MIME, UPLOAD_DIR } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Streams product media from UPLOAD_DIR with HTTP Range support so phone
// video players can seek. Only the basename is used, so `..` can't escape.
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;
  const name = path.basename(file.join('/'));
  const mime = EXT_TO_MIME[path.extname(name).toLowerCase()];
  if (!mime) return new Response('Not found', { status: 404 });

  const full = path.join(UPLOAD_DIR, name);
  const stat = await fs.stat(full).catch(() => null);
  if (!stat?.isFile()) return new Response('Not found', { status: 404 });

  const size = stat.size;
  const headers: Record<string, string> = {
    'Content-Type': mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (range) {
    let start = range[1] ? Number(range[1]) : NaN;
    let end = range[2] ? Number(range[2]) : NaN;
    if (Number.isNaN(start)) {
      // Suffix range: last N bytes.
      start = Math.max(size - (Number.isNaN(end) ? 0 : end), 0);
      end = size - 1;
    } else if (Number.isNaN(end) || end >= size) {
      end = size - 1;
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    const body = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream;
    return new Response(body, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  const body = Readable.toWeb(createReadStream(full)) as ReadableStream;
  return new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } });
}
