import { put } from '@vercel/blob';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Storage not configured' });
  try {
    const source = 'https://static.metricool.com/planner/202611/7935545-file-13186046957161018237.jpeg';
    const response = await fetch(source, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(502).json({ error: 'Source image unavailable' });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 100 || bytes.length > 8 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return res.status(415).json({ error: 'Invalid source JPEG' });
    const blob = await put('social/transfer-verification-20261107.jpeg', bytes, { access: 'public', contentType: 'image/jpeg', addRandomSuffix: false, allowOverwrite: true });
    return res.status(201).json({ url: blob.url, size: bytes.length, type: 'image/jpeg' });
  } catch (e) {
    console.error('Social transfer test', e);
    return res.status(500).json({ error: 'Transfer test failed' });
  }
}
