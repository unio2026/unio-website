# UNIO Discovery & Outreach — operating specification (v0.1)

Status: initial implementation blueprint. No automated messaging is enabled.

## Mission
Find people and organisations who might value UNIO, introduce the proposal accurately and respectfully, and measure genuine interest. UNIO is a developing initiative, not an already-operating profit-sharing ecosystem.

## Opportunity sources
- Public discussions about customer loyalty, shared prosperity, worker participation and fairer business models.
- Creators, community organisers, journalists and organisations discussing those themes.
- Relevant events and publications with clearly permitted contact routes.

Only collect information necessary for an outreach opportunity. Avoid sensitive personal attributes and scraping prohibited by platform terms.

## Prospect record
id, discovered_at, source_url, source_type (discussion/ally), public_context, relevance_reason, score, status, contact_route, outreach_draft, approval, contacted_at, reply_summary, referral_tag, visits, registrations.

Do not store private contact details without an appropriate lawful basis. Do not publish the prospect database in this repository or client-side code.

## Scoring (0–100)
- Direct relevance to UNIO's actual proposition: 0–40
- Evidence of a current, contextual opportunity: 0–25
- Appropriateness of contact channel: 0–20
- Potential for constructive dialogue: 0–15

## Pipeline
Discovered → Qualified → Drafted → Awaiting approval → Contacted → Responded → Interested → Registered.
Also: Rejected, Not appropriate, Do not contact.

## Outreach rules
1. Human approval before any message or public post.
2. No unsolicited mass DMs, fake accounts, impersonation or deceptive claims.
3. Follow platform rules, UK GDPR and PECR as applicable; honour opt-outs.
4. Personalise to the public context; do not exploit vulnerabilities.
5. State clearly what UNIO currently is and what is only proposed.
6. Do not send follow-ups unless appropriate and permitted.
7. Keep an audit trail of approved outreach and outcomes.

## Measurement
Weekly: qualified opportunities, approved introductions, messages sent, meaningful responses, visits from tagged links, registrations, opt-outs.
Track referral tags on links, never expose personal identifiers in URLs. Avoid interpreting clicks as commitments.

## Technical implementation
- Keep the existing public website unchanged initially.
- Build an authenticated, private workspace for discovery, review and approvals.
- Use server-side scheduled research only where the source permits access.
- Store records and secrets server-side with access controls.
- Start with manual/approved prospect imports; integrate supported sources later.
- Test the full workflow with synthetic records before using real prospects.

## First pilot
50 qualified opportunities; 20 individually reviewed introductions; 5 meaningful responses as a testing target, not a forecast. Registration count is measured independently.

## Next engineering tasks
1. Confirm repository deployment and storage architecture.
2. Create private database with role-based access.
3. Implement opportunity intake and deduplication.
4. Implement approval queue, status transitions and audit history.
5. Add campaign/referral attribution and aggregate reporting.
6. Run limited, human-approved pilot.
