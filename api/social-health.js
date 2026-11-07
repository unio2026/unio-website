export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const configured = Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.UNIO_UPLOAD_SECRET);
  return res.status(configured ? 200 : 503).json({
    service: 'unio-social-artwork',
    configured,
    acceptedTypes: ['image/jpeg', 'image/webp'],
    maxBytes: 8388608
  });
}
