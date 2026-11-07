import { put } from '@vercel/blob';
import { timingSafeEqual, randomUUID } from 'node:crypto';

export const config = { api: { bodyParser: false } };

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = { 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.UNIO_UPLOAD_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
  if (!expected || !process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Upload service not configured' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const type = (req.headers['content-type'] || '').split(';')[0].trim();
  if (!TYPES[type]) return res.status(415).json({ error: 'Only JPEG and WebP accepted' });
  const length = Number(req.headers['content-length']);
  if (!Number.isFinite(length) || length < 1 || length > MAX_BYTES) {
    return res.status(413).json({ error: 'Invalid image size (maximum 8 MB)' });
  }
  try {
    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
      total += chunk.length;
      if (total > MAX_BYTES) return res.status(413).json({ error: 'Image too large' });
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    const valid = type === 'image/jpeg'
      ? bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid) return res.status(415).json({ error: 'Image signature does not match content type' });

    const path = 'social/' + randomUUID() + '.' + TYPES[type];
    const blob = await put(path, bytes, { access: 'public', contentType: type, addRandomSuffix: false });
    return res.status(201).json({ url: blob.url, contentType: type, size: bytes.length });
  } catch (err) {
    console.error('UNIO social upload failed', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
