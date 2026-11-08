# UNIO operations

## Independent publishing

- English Instagram: @unio.pal, Metricool brand 7935545. Six-hour task enabled.
- Spanish Instagram: @unio.es, Buffer channel 6aefc01ae29c69a1719ce031. Separate 00:00/06:00/12:00/18:00 Europe/London task.
- TikTok must never block Instagram. Do not add TikTok to the English task.
- Ordinary brand posts are authorised; external comments and outreach still require founder approval.

### Verified local media delivery

Metricool createScheduledPost `mediaFiles` takes **absolute local file paths**, not URLs. The connector uploads the actual bytes; a Drive/GitHub/Vercel bridge is unnecessary. Supply a validated RGB JPEG, future ISO date **with timezone offset**, and a JSON `info` object with `text`, `providers:[{"network":"instagram"}]`, `autoPublish:true`, `draft:false`, `instagramData:{"autoPublish":true,"type":"POST","isAiGenerated":true}`, and accurate `mediaAltText`.

A fresh bakery image was accepted on 8 November 2026 as post UUID -6356751351255708143 for 01:09 Europe/London. Acceptance means scheduled, not published. Check provider outcome and permalink before claiming publication. Never reuse this artwork.

Buffer's Spanish first live post: https://www.instagram.com/p/DfdfT2sFCVa/ . Its recurring unattended execution remains to be verified. Authentication or approval failures must be reported honestly.

## Website

- English: https://unio.today/
- Spanish: https://unio.today/es.html
- Privacy: /privacy.html and /privacidad.html
- Tagged Spanish destination: https://unio.today/es.html?utm_source=instagram&utm_medium=social&utm_campaign=unio_es
- Tagged English destination: https://unio.today/?utm_source=instagram&utm_medium=social&utm_campaign=unio_en
- /social-preview.jpg rewrites to the existing approved hero image (1846 x 852).

## Registration

The shared assets/interest.js submits to the Supabase register-interest Edge Function. Its source is versioned under supabase/functions/register-interest/index.ts; publish backend changes separately with Supabase tooling.

Source categories are allowlisted: landing (legacy), website_en, website_es, instagram_en, instagram_es. Full referrer URLs, arbitrary campaign strings and advertising cookies are not stored for attribution. Attribution is an indication, not verified identity. The `notice_version` column records the notice presented at submission; legacy rows remain NULL. Optional updates remain separate from contact consent.

On 8 November the Spanish tagged browser submission, backend insert, source/notice fields and success message were verified end to end. The synthetic test row was removed. Invalid requests and honeypot non-insertion were also checked. Do not create real mailing subscriptions during tests.

## Discovery

public.discovery_social_opportunities is a private server-managed queue for exact verified Instagram /p/ or /reel/ URLs, context, relevance, draft and review status. RLS is enabled; anon/authenticated grants are revoked. The scheduled discovery task must show findings in its report for founder review. Do not mistake successful task execution for successful engagement.

## Remaining verification

- Verify unattended runs of both publishing tasks.
- Authorised Instagram comment integration remains blocked; do not auto-reply.
- Provider transfer arrangements and ongoing retention handling need operational review; a revised notice is not a legal compliance certification.
- Compromised-password protection in Supabase Auth remains disabled; review available plan/configuration before enabling.
