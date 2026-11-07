# UNIO social image upload

`POST /api/social-upload` accepts raw JPEG or WebP bytes (maximum 8 MB), with `Content-Type` and `Content-Length` headers and `Authorization: Bearer <UNIO_UPLOAD_SECRET>`.

The function requires the production environment variables `UNIO_UPLOAD_SECRET` and `BLOB_READ_WRITE_TOKEN`. It stores each image under a random `social/` path in Vercel Blob and returns a public URL for Metricool to import.

Never put the upload secret in browser JavaScript, a repository, a URL, or a public automation prompt. Use a trusted backend or secure secret-bearing workflow. The endpoint intentionally rejects unauthenticated requests.

To verify safely: first GET should return 405, unauthenticated POST should return 401, and an authenticated JPEG POST should return 201 with a public Blob URL. Confirm Metricool can ingest that URL before enabling unattended publishing.
