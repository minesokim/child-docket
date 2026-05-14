# DocuSign KBA + IRS Pub 1345 — Current State Verification

**Date:** 2026-05-14
**Author:** Docket architecture research
**Scope:** Verify CLAUDE.md §6 assumptions about DocuSign KBA, LexisNexis InstantID Q&A, and IRS Pub 1345 compliance for remote 8879 e-signature.

**TL;DR:** The CLAUDE.md framing is *mostly right but a year out of date in two important ways*. (1) IRS Pub 1345 (Rev. 12-2025) still anchors to NIST SP 800-63-3 IAL2 and still accepts KBA — but NIST SP 800-63-4 was finalized July/Aug 2025 and explicitly states KBA "does not constitute an acceptable secret for digital authentication." The IRS has not yet realigned Pub 1345 to 63-4. (2) The CLAUDE.md alternative path "two-factor + ERO-known information" is *also* explicitly allowed by Pub 1345 today — meaning Docket can ship an 8879-compliant flow without a credit-bureau KBA call on every signing, at significant cost savings. The $3 / $1.50 retail/wholesale figures are still in the right ballpark for credit-bureau KBA, but the more interesting fork is whether Docket needs credit-bureau KBA *at all* in v1.

---

## 1. IRS Pub 1345 current requirements (verbatim)

**Current publication:** Publication 1345, *Authorized IRS e-file Providers of Individual Income Tax Returns*, Rev. 12-2025. This is the canonical document and is the live version for TY2025 returns being filed in 2026, and for TY2026.

**The remote 8879 / 8878 e-signature rule (paraphrased from the live document):**

If the taxpayer is **not physically present** with the ERO, the ERO must use an identity verification method meeting **NIST SP 800-63-3, Identity Assurance Level 2 (IAL2)**. The publication enumerates two acceptable patterns:

- **Option 1 — Third-party KBA.** Credit-bureau-sourced knowledge-based authentication via a third-party provider; LexisNexis and TransUnion are the explicitly-named examples.
- **Option 2 — 2FA + ERO-known information.** A combination of two-factor authentication (e.g. SMS or email OTP) AND identity verification based on information the ERO knows or can confirm the taxpayer knows.

**Frequency:** Identity verification must be performed *every time* a taxpayer remotely signs an 8878 or 8879. Two carve-outs: (a) physical-presence signing, and (b) "multi-year business relationship" where the ERO has previously originated returns for that taxpayer and the original verification is on file.

**Recordkeeping:** EROs must capture and retain, for at least 3 years from the later of the due date or the IRS-receipt date:

- Digital image of the signed form
- Date/time of signature
- Taxpayer IP address (remote only)
- Login ID (remote only)
- Identity verification result (pass/fail with question-set metadata)
- Audit trail of signature method

**Penalty regime:** Tiered — written reprimand → 1-year suspension → 2-year suspension or permanent expulsion for fraud / repeated identity-theft involvement.

**The NIST 800-63-4 wrinkle (this is new since CLAUDE.md v0):**

NIST SP 800-63-4 was finalized in July 2025 and published August 2025. It supersedes 800-63-3. The final version contains the now-much-quoted line: *"Knowledge-based authentication (KBA), where the claimant is prompted to answer questions that are presumably known only by the claimant, does not constitute an acceptable secret for digital authentication."*

800-63-4 also formally recognizes **remote unattended identity proofing** (selfie + government ID + presentation-attack-detection + deepfake analysis), **mobile driver's licenses (mDLs)** and **verifiable credentials** as IAL2-grade identity evidence.

**IRS posture:** As of Pub 1345 Rev. 12-2025, the IRS still cites 800-63-**3** (not -4) and still accepts KBA. There is no published deadline for the IRS to migrate. The realistic read: KBA remains compliant for 8879 through at least TY2026, probably TY2027, but a structural change is coming. Any architecture decision Docket makes now should anticipate the transition.

## 2. DocuSign's current 8879-compliant offering

**Product naming:** The KBA capability lives in a product family called **DocuSign Identify**, which sits on top of (and is sold as an add-on to) eSignature. It covers Document & Biometric Verification, Phone OTP, KBA, eIDs, CLEAR integration, and risk-based verification. KBA specifically routes through LexisNexis Risk Solutions under the hood — confirmed via DocuSign developer docs.

**8879 marketing posture:** DocuSign's accounting/tax solutions page explicitly references Form 8878 and Form 8879 by number. The eSignature product is marketed as conforming to IRS requirements for these forms. DocuSign does *not* hold an independent "8879 compliant" certification because no such certification exists — Pub 1345 places the compliance obligation on the ERO, not the e-signature vendor. The vendor's job is to provide a tool that lets the ERO meet the rule.

**Embedded signing + KBA:** The DocuSign REST API supports KBA via the recipient's `idCheckConfigurationName` (or equivalent) on envelope creation. Embedded signing (signers redirected into the host application via the JS SDK) is compatible with KBA — the recipient is challenged with the KBA question set as part of the signing session. Integration time is documented as 1–2 days for OAuth + envelope creation + embedded recipient view.

**Pricing (May 2026, retail):**

- **eSignature base tiers:** Personal $10/mo (5 envelopes), Standard $25/user/mo, Business Pro $40/user/mo. Enterprise is custom. None of the base tiers include Identify/KBA.
- **API/Developer tiers:** Starter $600/yr (~40 envelopes/mo), Intermediate $3,600/yr (~100 env/mo), Advanced $5,760/yr (~100 env/mo + bulk).
- **Identify / KBA add-on:** Typically **$2.50–$3.00 per ID-verification attempt** at small volumes; sources show $2.50 as the most common starting price and $3.00 as the common "all-in with KBA" cost. Note: *every* attempt counts, even failed ones — Pub 1345 allows 3 attempts before a hard-fall-back to wet signature.
- **TaxAct's resold rate (illustrative ceiling):** $2.99/envelope including up to 2 KBAs.

**Reality check on the CLAUDE.md "~$3/KBA via DocuSign" number:** Correct for retail / small-volume. At enterprise volume (mid-market customer with 500+/mo) the per-unit drops, but a customer at Docket's likely v1 scale (10–50/mo) will see ~$3 sticker.

**Case studies:** No high-visibility public case study of a national tax-prep firm running DocuSign for 8879 at scale. Intuit (Lacerte, ProConnect), TaxAct, and Drake all *resell* DocuSign or have proprietary bundles. The dominant 8879 e-sign vendors for independent firms are TaxDome, SmartVault, Encyro, Liscio, Verifyle, and CountingWorks PRO — most of which are KBA wrappers on top of LexisNexis. TaxDome quotes **$1/KBA** wholesale-passed-through pricing, which sets the realistic competitive floor.

## 3. Alternative KBA providers — pricing comparison

| Provider | Per-KBA price (small-vol) | API quality | NIST IAL2 today | Notes |
|---|---|---|---|---|
| **DocuSign Identify** | $2.50–$3.00 | Excellent — embedded signing + KBA in one envelope flow | Yes, via LexisNexis | The "easy button." Highest cost. |
| **LexisNexis InstantID Q&A** direct | ~$1.00–$1.50 (volume-dependent, custom-quoted) | Good — SOAP/REST hybrid, somewhat dated DX | Yes (it IS the underlying engine) | Requires enterprise contract + minimums; no public price |
| **TransUnion TruValidate / TLOxp KBA** | Custom quote; $75/mo minimums typical | Good | Yes | Less commonly used for 8879; more skip-trace flavored |
| **Equifax Identity Verification API** | $0.50–$5.00 per verification (custom) | Good | Yes | Pricing rarely below $1 at small volume |
| **TaxDome (resold KBA)** | **$1/KBA** | Tax-vertical, not API-first | Yes | The competitive floor for the tax-specific market |
| **SmartVault** | Unlimited included in Accounting Unlimited plan ($480/user/yr-ish) | Tax-vertical | Yes | Flat-rate, no per-KBA pricing |
| **Encyro** | SMS-code "transactional KBA" — Option 2 pattern | Tax-vertical, lightweight | Yes (Option 2 path) | **Sidesteps credit-bureau KBA** by using 2FA + AGI-known facts |
| **CountingWorks PRO** | Bundled | Tax-vertical | Yes (Option 2 path) | Explicitly markets Option 2 (2FA + client-known data) |
| **ID.me** | Custom (gov-procurement priced) | Government-grade; selfie + ID + KBA + IAL2-certified | Yes, IAL2-certified | IRS itself uses ID.me for taxpayer-side login. Heavy onboarding UX. |
| **Persona** | $0.50–$3.00 per verification (selfie+ID flavor) | Excellent API/DX | Configurable to IAL2 (with KBA module) | Selfie+ID is *not* 8879-compliant today under 800-63-3 phrasing; would need their KBA add-on |
| **Jumio** | $0.80–$5.00 per verification | Excellent | Configurable | Same caveat as Persona |
| **Onfido** | $0.80–$3.00 per verification | Excellent | Configurable | Same caveat |
| **Stripe Identity** | $1.50 per selfie+ID check | Excellent API/DX | **NOT IAL2 today for 8879 purposes** | Confirms CLAUDE.md's claim. No KBA module. |

**Small-scale (10–50/mo) vs scale (1000+/mo):** DocuSign is roughly 2–3× the cost of TaxDome at small scale and probably 4–6× the cost of LexisNexis-direct at 1000+/mo. The wholesale gap is real but only matters if Docket is willing to take on the LexisNexis enterprise contract (typically $5K–$15K/yr minimum spend + integration work).

## 4. Documenso self-hosted path

**Status:** Documenso is actively developed, AGPL-3.0 licensed, self-hostable via Docker/Compose/Railway/K8s. Cloud-hosted tier starts at $30/mo with API access. It is the most credible open-source DocuSign alternative as of May 2026 (the others in the running being DocuSeal, OpenSign, LibreSign).

**What's in the open-source core:** Document send/sign, multi-party flows, templates, audit trails, API + webhooks, embed editor, team management, branding.

**What's NOT in the open-source core:** No native KBA. No native 8879 mode. SSO, the white-label embed editor in commercial form, and 21 CFR Part 11 compliance features are gated behind the **Enterprise** commercial license (not the AGPL build).

**Compliance claims:** Documenso markets ESIGN Act, UETA, 21 CFR Part 11 (Enterprise), SOC2, HIPAA, eIDAS. It does **not** market IRS Pub 1345 compliance. That's because compliance is a property of the ERO's *deployment*, not the e-sig tool itself.

**KBA integration possibilities:** Because Documenso is open source and has a recipient-step plugin model, Docket *could* fork or extend it to inject a LexisNexis-direct or other-KBA-provider step before the signing screen renders. This is non-trivial engineering — the recipient state machine, audit logging, and tamper-evident sealing all need to integrate cleanly. Realistic effort: 2–4 weeks of focused engineering. The Pub 1345 audit-trail requirements (IP, timestamp, login, verification result, signature method) all need first-class log fields.

**License consideration:** AGPL-3.0 is *network copyleft*. If Docket runs a modified Documenso server-side and clients interact with it over the network, Docket must offer source for the modifications under AGPL. This is a significant constraint for a closed-source AI tax product. The realistic paths are: (a) keep the Documenso fork in a separate, narrowly-scoped repo and publish it; (b) negotiate an Enterprise license that grants commercial relicensing; (c) skip Documenso entirely.

## 5. Recent IRS guidance on AI-prepared returns

**IRS Internal AI Policy (IRM 10.24.1, Feb 2026):** Governs IRS's *own* use of AI. Notable bits: "the use of GenAI tools to create deceptive, misleading, or other content that violates law or policy is expressly prohibited" and GenAI cannot be used to make binding determinations on taxpayer rights without proper oversight. This is internal IRS policy and does **not** directly bind tax preparers — but it signals the agency's posture.

**External / preparer-facing guidance on AI:** As of May 2026 there is **no specific IRS regulation or revenue procedure that addresses AI-prepared returns differently from human-prepared returns**. §6694 ("Understatement of taxpayer's liability by tax return preparer") still applies on a position-by-position basis. The "reasonable position" / "substantial authority" / "adequate disclosure" framework in Rev. Proc. 2026-12 (which updates Rev. Proc. 2024-44) is the live test, and it does not contemplate the tool used to generate the position.

**Practical read for Docket:**
- The signing preparer (human ERO) remains the §6694 obligor. AI assistance does not transfer or dilute that liability.
- AICPA / Circular 230 considerations apply when AI prompts may include privileged client data — Docket must not exfiltrate client data to third-party LLMs in a way that breaks confidentiality.
- The IRS's stated public warning ("taxpayers should not rely on AI-generated responses to complex tax questions and should verify any calculations") is a reputational/marketing signal, not a regulatory one — but it should inform the UX (always-on preparer review gate, "you (the ERO) are responsible" framing).

**Bottom line:** AI doesn't change the 8879 KBA story. It does raise the bar on preparer-review UX and audit-trail completeness, both of which are orthogonal to the KBA decision.

## 6. Recommended path for Docket

**V1 ship (next 8–16 weeks): DocuSign embedded signing + DocuSign Identify KBA.**

Rationale:
1. **Time-to-compliance.** DocuSign is the only path where the entire 8879-compliant flow — envelope, recipient verification, signing, audit log retention — is one API surface and one vendor relationship. No LexisNexis enterprise contract negotiation, no minimums.
2. **Audit posture.** DocuSign holds the audit-trail packaging in a way that survives IRS inspection cleanly. Self-hosted alternatives put that burden on Docket.
3. **Per-engagement economics are tolerable.** At ~$3/KBA + ~$1–2 per envelope amortized in the Starter/Intermediate developer tier, an 8879 signing costs Docket ~$5 all-in. If Docket charges $200–$500+ per return, the signing cost is <2% of revenue. Not the hill to optimize first.
4. **Reversible.** Migrating to a Documenso+LexisNexis stack later is a multi-month project, but nothing about v1 forecloses that path.

Implementation shape:
- DocuSign API integration, Starter tier ($600/yr) until volume justifies upgrade.
- Embedded signing via `RecipientView` + `EnvelopeViews` API.
- `idCheckConfigurationName="ID Check $"` on the signer recipient → KBA challenge.
- Webhook on envelope-completed → Docket writes signed PDF + audit metadata into the engagement record.
- Pub 1345 audit fields (IP, time, login, verification result, method) captured into Docket's own audit table, not relying on DocuSign for retention.

**One caveat to research before committing:** Docket should verify with DocuSign sales whether the Developer Starter tier is contractually OK for production-tax use (some Developer SKUs are dev-only and force an upgrade for production traffic). Treat $600/yr as a probably-optimistic baseline.

## 7. V1.5+ migration path

**When does direct LexisNexis (or Documenso + LexisNexis) make sense?**

Three signals:

1. **Volume.** At ~500 KBAs/mo, the DocuSign markup over LexisNexis-direct starts costing ~$10K/yr. At 2000/mo it's $40K/yr — Docket-engineer-month territory.
2. **Product differentiation.** If Docket wants signing *inside* the AI conversational UX (not a redirect to DocuSign), Documenso (or a custom embed) is the only path.
3. **Vendor-risk diversification.** Single-vendor risk on DocuSign is real (pricing changes, deprecations, terms-of-service updates). A Documenso fork puts Docket in control.

**Sequence when triggered:**
1. Negotiate LexisNexis InstantID Q&A contract (expect 6–12 week procurement; $5K–$15K annual minimum).
2. Stand up Documenso self-hosted in a Docket-owned VPC (Docker Compose or K8s).
3. Build the KBA-step plugin that calls LexisNexis pre-signing and writes results into Documenso's recipient state.
4. Run parallel for 30–60 days (both DocuSign and Documenso paths live, A/B by engagement).
5. Cut over; keep DocuSign as the failover for KBA-fail or system-down.

**Alternative migration to NIST 800-63-4-ready:** Instead of (or alongside) LexisNexis-direct, Docket could pre-empt the NIST shift by offering a remote-attended **selfie + government ID + presentation-attack-detection** flow via Persona / Onfido / Jumio. This is *not* sufficient under Pub 1345 today (because Pub 1345 still cites 800-63-3 and lists KBA or 2FA+known-info as the only two methods), but it is what IAL2 will look like under 800-63-4. Building toward it now is reasonable hedging.

## 8. Cost math

Assumptions: $200 average revenue per 8879 signing (low-end mass-market) → $1,500 (high-net-worth).

**At v1 (DocuSign retail):**

| Component | Cost |
|---|---|
| DocuSign envelope (Starter tier amortized) | ~$1.25 |
| DocuSign Identify / KBA (1 successful attempt) | $2.50–$3.00 |
| KBA failure overhead (assume 5% need re-attempt) | $0.15 |
| **Total per-engagement signing cost** | **~$4–$5** |
| **As % of $200 engagement** | 2.0–2.5% |
| **As % of $1,500 engagement** | 0.3% |

**At v1.5 (LexisNexis-direct + Documenso self-hosted):**

| Component | Cost |
|---|---|
| LexisNexis InstantID Q&A (volume-priced) | $1.00–$1.50 |
| Documenso self-hosted infra (amortized at 500/mo) | ~$0.10–$0.20 |
| KBA failure overhead | $0.05–$0.10 |
| LexisNexis contract minimum amortized (assume $8K/yr ÷ 500 × 12 = ~$1.33/sig at 6000/yr) | ~$1.33 |
| **Total per-engagement signing cost** | **~$2.50–$3.20** |
| **Savings vs v1** | ~$1.50–$2.50 per signing |
| **Break-even on engineering** (2–4 weeks of senior eng at $20K) | 8K–13K signings |

**Annualized:** At Docket's plausible v1.5 scale of 5K signings/yr, the savings are ~$10K — barely worth the engineering. At 15K signings/yr the savings approach $30K and the migration starts to pencil.

## 9. Corrections to Docket's prior framing

The CLAUDE.md §6 framing was sound directionally but needs five updates:

1. **NIST is moving.** The CLAUDE.md text references "NIST IAL2" as a static standard. NIST SP 800-63-4 (final July 2025) deprecates KBA as an acceptable authentication secret. The IRS has not yet updated Pub 1345 to cite 63-4, but the structural shift is in motion. Architectural decisions should anticipate a future where credit-bureau KBA is no longer the canonical path — selfie+ID+PAD will be.

2. **"KBA on every remote 8879 signing" is partly wrong.** Pub 1345 explicitly offers **Option 2**: two-factor authentication PLUS identity verification based on information the ERO knows or can confirm the taxpayer knows (e.g. prior-year AGI, prior-year refund, DOB, EIN). CountingWorks PRO, Encyro, and Verifyle ship this pattern in production today. This is an opportunity, not a footnote — for returning clients, Docket may not need a credit-bureau KBA call at all.

3. **The $3 / $1.50 numbers are roughly correct but the spread is wider than implied.** Retail DocuSign is $2.50–$3.00. TaxDome's bundled rate is $1.00 (this sets the competitive floor in the tax vertical). LexisNexis-direct at volume can hit $1.00–$1.50 *but only with a meaningful annual minimum spend* (~$5K–$15K) and a procurement cycle.

4. **"LexisNexis InstantID Q&A direct" requires more than a checkbox.** The wholesale path is real but it comes with: enterprise contract, annual minimum, SOAP/REST hybrid API with somewhat dated DX, manual integration work for audit-log capture, and ~6–12 weeks of procurement. It's not a "swap out DocuSign for an API call" decision — it's a 2–4 week engineering project plus a procurement project.

5. **Documenso is one option but not a turnkey 8879 stack.** Documenso is AGPL-3.0 (which has real network-copyleft implications for a closed-source product), has no native KBA, and would need a custom KBA-step plugin to be 8879-compliant. The alternative ("just use Documenso self-hosted") is technically viable but is 2–4 weeks of work, not configuration.

**Net:** The CLAUDE.md v0 path (DocuSign now → Documenso+LexisNexis later) is still the right directional bet, but v1 should also bake in **Option-2 (2FA + known-info) as a second-class path for repeat clients with prior-year AGI on file** — this is the highest-leverage UX and cost optimization in the whole compliance surface area.

## 10. Citations

- [IRS Publication 1345 (Rev. 12-2025)](https://www.irs.gov/pub/irs-pdf/p1345.pdf) — current canonical document
- [IRS FAQ — IRS e-file Signature Authorization](https://www.irs.gov/e-file-providers/frequently-asked-questions-for-irs-efile-signature-authorization)
- [Centraleyes — IRS Publication 1345 explainer](https://www.centraleyes.com/irs-publication-1345/)
- [LegalClarity — IRS KBA Requirements: Rules, Limits, and Penalties](https://legalclarity.org/what-are-the-irs-knowledge-based-authentication-requirements/)
- [Encyro — Form 8879 IRS-Compliant Electronic Signature](https://www.encyro.com/blog/form-8879-irs-compliant-signature)
- [CountingWorks PRO — eSignature Compliance Policy for Form 8879](https://help.countingworkspro.com/esignature-compliance-policy-for-form-8879)
- [Hive AI — Electronic signature requirements for tax documents](https://hivetax.ai/electronic-signature-requirements-for-tax-documents/)
- [NIST SP 800-63-4 final (CSRC)](https://csrc.nist.gov/pubs/sp/800/63/4/final)
- [NIST 800-63-4 IAL identity-proofing requirements (live HTML)](https://pages.nist.gov/800-63-4/sp800-63a/ial/)
- [ID Dataweb — NIST SP 800-63-4 readiness](https://www.iddataweb.com/2025-nist-guidelines/)
- [HYPR — NIST 800-63-3 & -4 Digital Identity Guidelines review](https://www.hypr.com/blog/nist-sp-800-63-3-digital-identity-guidelines-review)
- [DocuSign — Identify product page](https://www.docusign.com/products/identify)
- [DocuSign — Accounting and Tax solutions](https://www.docusign.com/solutions/industries/accounting-tax)
- [DocuSign Developer — How-To Require KBA for a Recipient](https://developers.docusign.com/docs/esign-rest-api/how-to/knowledge-based-authentication/)
- [DocuSign Developer — JS for embedded signing reference](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/embedding/docusign-js-embedded-reference/)
- [DocuSign Developer API plans](https://ecom.docusign.com/plans-and-pricing/developer)
- [Signbee — E-Signature API pricing comparison 2026](https://signb.ee/blog/e-signature-api-pricing-comparison-2026)
- [TaxAct Professional eSignatures (DocuSign-backed) pricing](https://www.taxact.com/professional/efiling/esignature)
- [Documenso — main site](https://documenso.com/)
- [Documenso — self-hosting docs](https://docs.documenso.com/docs/self-hosting)
- [Documenso — GitHub](https://github.com/documenso/documenso)
- [Sliplane — 5 Open-Source DocuSign Alternatives](https://sliplane.io/blog/5-open-source-docusign-alternatives)
- [LexisNexis — InstantID Q&A product page](https://risk.lexisnexis.com/products/instantid-q-and-a)
- [LexisNexis — Identity Verification (Corporations & Non-Profits)](https://risk.lexisnexis.com/corporations-and-non-profits/fraud-and-identity-management/identity-verification-and-authentication)
- [TaxDome — Knowledge-Based Authentication help](https://help.taxdome.com/article/287-knowledge-based-authentication-kba)
- [TaxDome — E-signature feature page ($1/KBA)](https://taxdome.com/e-signature)
- [SmartVault — Knowledge-Based Authentication](https://www.smartvault.com/resources/knowledge-based-authentication/)
- [Liscio — Form 8879 E-Signing for Tax Pros](https://www.liscio.me/features/form-8879-e-signing)
- [ID.me and IRS FAQs](https://help.id.me/hc/en-us/articles/28400723319191-ID-me-and-IRS-FAQs)
- [IRS IRM 10.24.1 — Policy for AI Governance](https://www.irs.gov/irm/part10/irm_10-024-001r)
- [Tax Notes — IRS Updates Accuracy-Related Penalty Guidance (Rev. Proc. 2026-12)](https://www.taxnotes.com/research/federal/irs-guidance/revenue-procedures/irs-updates-accuracy-related-penalty-guidance/7tykk)
- [26 U.S.C. § 6694 — Tax return preparer understatement penalty (LII)](https://www.law.cornell.edu/uscode/text/26/6694)
- [PwC — IRS permanently extends electronic signatures for certain forms](https://www.pwc.com/us/en/services/tax/library/pwc-irs-permanently-extends-electronic-signatures-for-certain-forms.html)
