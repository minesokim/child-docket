# Employee Training & Awareness Policy

**Version:** 1.0
**Effective:** 2026-05-09
**Owner:** Founder
**Review cadence:** annual + after any material policy change

---

## 1. Purpose

Define the training every Docket personnel completes — at onboarding, annually, and after material policy changes — to ensure consistent application of security policies and informed handling of customer data.

---

## 2. Scope

Applies to:
- Founder (currently the only personnel; trains self).
- Future contractors and hires.
- Future tax-domain advisory contractors handling customer data (legal, accounting, tax-research).

Explicitly excluded:
- Vendors (governed by their own SOC 2 + DPAs per `vendor-management-policy.md`).
- Customer firm-owners + their staff (their own firms' training applies; we provide product-level guardrails).

---

## 3. Onboarding training

Every new principal completes within their first 5 working days:

1. **Read every doc in `docs/security/`.** Sign acknowledgment in `docs/security/training-log.md` with date + version of each doc.
2. **Review CLAUDE.md** in full (especially §🔒 LOCKED DECISIONS, §1 Project identity, §15 Build order, §18 Repo structure & conventions).
3. **MFA setup** on every system per `access-control-policy.md` §3.
4. **1Password vault access** + walk-through of secret-handling rules.
5. **Github branch-protection acknowledgment** — never push to `main` directly; always PR; codex review on every feat/fix.
6. **PII handling walk-through** — `data-classification-and-handling.md` + the PII regex scrubber.
7. **Incident response orientation** — read `incident-response-plan.md`; know the 5-min ack ladder for P1.
8. **Phishing-resistance briefing** — common attack vectors against tax-pro adjacents; vendor-impersonation patterns; "the bank fraud" pattern targeting EAs handling client wires.

Onboarding completion logged at `docs/security/training-log.md` with founder co-signature.

---

## 4. Annual refresher

Every January (start of tax season prep), each principal:

1. Re-reads all policy docs in `docs/security/`. Reviews any policy that has changed since their last sign-off.
2. Phishing simulation (founder runs against all personnel; tracks click-through; review any failures).
3. Incident-response tabletop participation (per `incident-response-plan.md` §8).
4. Access-review attestation — confirms they still need every system access they have; surfaces any access for revocation.

Annual completion logged at `docs/security/training-log.md`.

---

## 5. Material-policy-change refresher

When any policy in `docs/security/` is materially updated (not typo fixes, but real policy shifts), every personnel completes:

1. Reads the diff + the rationale.
2. Signs acknowledgment within 5 working days.
3. Logged at `docs/security/training-log.md`.

---

## 6. Tax-domain training (when tax co-founder + advisors join)

Beyond standard security training, tax-domain personnel handling customer data complete:

1. **Position framework deep-dive** — `docs/POSITION-FRAMEWORK.md`. Understanding the four-tier confidence framework + refusal floor.
2. **Trust escalation model** — CLAUDE.md §8 Trust escalation.
3. **PTIN / EA / CPA discipline** — every position the personnel touches affects a real PTIN; preparer signs and is on the hook. The platform supports the preparer; it does not replace their judgment.
4. **§7216 awareness** — federal protection of taxpayer information; what counts as disclosure; consent requirements.
5. **Bilingual handling** — when serving Spanish/Mandarin/Vietnamese/Tagalog clients, language-specific best practices.

---

## 7. Specific awareness topics

### Phishing patterns common in the tax-pro neighborhood

- **IRS-impersonation emails** — "your client's account has been flagged; click here." Real IRS doesn't email; always verify via Tax Pro Account.
- **Vendor-impersonation** — "Twilio account verification required" with a fake login page. Verify all vendor outreach via the vendor's authenticated app, not via email links.
- **Wire-fraud targeting EAs** — "client" email instructing wire transfer to new account. Always verify via known phone number.
- **Software-update scams** — "OLT update available" with malware payload. Updates only via the vendor's actual update channel.

### Social engineering against support

- "Hi, I'm the founder, I lost access, please reset" — Docket personnel never reset another principal's MFA without out-of-band verification.
- "I'm a partner at the firm, send me the data" — verify the principal via the established channel (Slack DM from existing account, or a known phone number).

### Insider-threat awareness

- Mass data export (>1,000 client records in a single query) triggers alerts.
- Unusual access patterns (logging in from unusual geography, accessing tenants the principal doesn't normally support) trigger alerts.
- Signs to watch for: financial pressure, dissatisfaction, recent termination notice.

### Vendor handling

- Don't paste customer data into a vendor's web form (e.g., a vendor support portal) without first redacting.
- Verify any vendor support session is initiated by Docket; never accept inbound calls claiming to be vendor support.

---

## 8. Documentation + acknowledgment trail

`docs/security/training-log.md` (created on first onboarding) records:
- Principal name + role
- Date of every training event (onboarding, annual, material-change)
- Version of each policy at the time of acknowledgment
- Phishing simulation results
- Tabletop participation

This log is the SOC 2 attestation evidence for "personnel are trained."

---

## 9. When team is ≤2 people

The founder trains and is trained simultaneously. The training log records "founder, self-attested" entries. When hire-1 lands, founder + hire-1 cross-train and cross-attest; the log gains real corroboration. By hire-3, training is institutional rather than self-attested.

---

**Last reviewed:** 2026-05-09 (initial draft, founder)
**Next review:** 2027-01 (annual cadence — start of tax season prep)
