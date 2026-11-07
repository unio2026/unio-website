import sharp from 'sharp';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const name = String(req.query.name || '');
  if (!/^unio-[a-z0-9-]{1,100}\.png$/.test(name)) return res.status(400).end();
  try {
    const url = new URL('/assets/social/' + name, 'https://unio.today');
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return res.status(404).end();
    const source = Buffer.from(await response.arrayBuffer());
    if (source.length > 8 * 1024 * 1024) return res.status(413).end();
    const jpeg = await sharp(source).rotate().resize({ width: 1440, height: 1920, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
    return res.status(200).send(jpeg);
  } catch (e) {
    console.error('JPEG conversion failed', e);
    return res.status(500).end();
  }
}
