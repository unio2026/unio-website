# UNIO direct Instagram administration

Owner dashboard: https://unio.today/admin.html

## Implemented

- Owner-only email login using the existing Supabase Auth project. The Edge Function checks a verified email against the private `social_admins` allowlist on every privileged request. The HTML shell is public; account records are not.
- Direct Instagram Login OAuth with single-use, ten-minute state; scopes for basic access, publishing, comments and messaging. App secrets and account tokens are AES-GCM encrypted server-side and never returned to the browser.
- Single-image JPEG post drafts, scheduling, account language, cancellation, a reusable approved-content library, a UTC daily cap and a global pause switch.
- Authenticated image upload and Instagram-compatible JPEG conversion via `/api/admin-media`, using the existing Vercel Blob store. Uploaded artwork is public.
- Direct comment and DM ingestion from HMAC-verified Meta webhooks, plus bounded manual synchronization (10 posts / 20 threads). Unique event keys prevent duplicate inbox entries.
- Manual replies and exact-match factual FAQ replies. Unknown enquiries go to owner review. Automated cold outreach, novel AI-generated claims and legal/financial commitments are not implemented.
- A five-minute Supabase Cron job invokes the worker. All outbound automation defaults off. Optional library queueing selects at most one item per account per UTC day after the configured UTC hour. A library item has a 30-day reuse cooldown. Posts need `auto_publish` enabled to leave the queue.
- Database worker lease, atomic post/reply claims and explicit review state for uncertain outcomes. Never automatically resend an ambiguous publication or reply.
- Inbox retention: 90 days. Audit retention: 180 days. Expired OAuth state and login throttles are cleaned up. Cleanup runs while operations are paused.

## Owner setup

1. Sign in at `/admin.html` using the authorised owner email. Open the sign-in email link, or paste its full Supabase verification URL / email code into the login form. Do not share the link or code.
2. In Meta for Developers, create the business app and add Instagram API with Instagram Login. Configure professional Business or Creator accounts; follow Meta's currently displayed requirements.
3. OAuth redirect: `https://zqllqmjcjozjphixcmvn.supabase.co/functions/v1/social-admin/callback`.
4. Webhook callback: `https://zqllqmjcjozjphixcmvn.supabase.co/functions/v1/social-admin/webhook`. Set a random verification token of at least 24 characters. Subscribe comments and messages. The same token must be saved in UNIO's setup form.
5. Enter the Instagram product's App ID, App Secret and the Graph API version from Meta's dashboard into the private setup form. Never put these in chat, Git, frontend files or a URL.
6. Required scopes: `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_messages`. Complete app review/business verification and tester acceptance if required. No permissions are presumed granted.
7. Privacy/deletion instructions: `https://unio.today/privacy.html#instagram`. Meta's current app configuration may require additional app-specific settings or callbacks.
8. Connect each account. Verify webhook account subscription and set account language. Test a single post and a message with the real account before enabling unattended rules.
9. Upload approved artwork and captions. Save individual schedules or add entries to the reusable library. Enable the desired rules, then unpause. Retain enough library items for the reuse cooldown; an empty eligible library does not trigger invented content.

The Meta development pages could not be retrieved in this execution environment. The OAuth, publishing and messaging implementation follows the Instagram Login API contract, but real account permissions, payloads, account linking and end-to-end delivery must be verified after app setup. Do not report an unconnected account as operational.

## Hosting and storage

Supabase project: `zqllqmjcjozjphixcmvn`; Edge Function `social-admin` does its own authentication, so gateway `verify_jwt` is false. Owner requests require verified Supabase tokens and allowlist membership. Meta webhooks require HMAC signatures; callbacks require valid state; worker requests require a separate random credential. Never switch off these in-function checks.

All `social_*` tables have RLS enabled, no public policies, and no table grants to `anon` or `authenticated`. Only the service role / database operator accesses them directly. The `net` schema is not exposed by the public REST API; anonymous calls using that schema were rejected. Supabase-managed default grants on extension functions remain unchanged. The Cron command reads a private worker credential from `social_secrets`; no cron credential is stored in this repository.

The token encryption key derives from `UNIO_SOCIAL_ENCRYPTION_KEY` when present, otherwise from the runtime service-role key with a fixed application prefix. Set a dedicated stable random key **before entering app credentials** if desired. Changing that key or rotating the fallback service-role key requires reconnecting/re-encrypting stored app credentials and tokens. Tokens are renewed near expiry while operations are enabled; revoked/expired access needs reconnecting.

Disconnect removes local account tokens, queued posts and stored conversations. Also revoke the app in Instagram to invalidate access at Meta. Instagram account deletion requests use the published email instructions; custom Meta data-deletion callbacks are not supplied by this version.

Existing Metricool/Buffer jobs are not migrated, disabled or duplicated automatically. Before enabling the new schedule, review existing social publishing tasks to avoid competing schedules.

## Verification

Run `node --test tests/social-admin.test.mjs`. Tests use mocked upstream APIs and do not send posts, messages or login emails. Live checks verify anonymous requests fail closed, all social tables deny anonymous/authenticated grants, and the authenticated scheduler returns `paused: true`. Actual owner email delivery and Meta calls remain dependent on account setup.

`pg_net` was initially installed with its extension metadata in `public`; its functions live in `net`. An optional drop/recreate relocation was rejected by automatic approval review because it could disrupt production. The extension remains installed. An attempted non-destructive grant restriction did not change Supabase-managed defaults; verification confirmed that `net` is not an exposed REST schema. The schema-location advisory can remain; no destructive relocation is needed to use this application.
