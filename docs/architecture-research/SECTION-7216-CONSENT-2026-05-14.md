# §7216 Third-Party Processor Consent — Current State

**Research date:** 2026-05-14
**Scope:** IRC §7216 + Treas. Reg. §301.7216-1, -2, -3 + Rev. Proc. 2013-14 applied to Docket's AI/cloud processor stack (Anthropic, AWS, Composio, Twilio, DocuSign, Square, Vercel, Neon, Cloudflare R2, Fly.io, Cohere).

**Bottom line up front:** §7216 is a **criminal** statute that applies to every tax preparer who routes client data through any third party. The regulation contains a narrow set of consent-free disclosure categories — the most important for Docket being §301.7216-2(d)(2) (contractors providing "auxiliary services" like cloud/software/equipment). That carve-out does **not** require client consent but **does** require Docket to give each contractor a written §6713/§7216 notice. Substantive AI determinations, offshore processing, and any marketing-adjacent use trigger full Rev. Proc. 2013-14 written consent. There is **no §7216 case law specifically blessing AI/LLM use** as of May 2026 — the regulation predates LLMs and Treasury has issued no specific guidance, so Docket should design to the most conservative reading.

---

## 1. The statute + regulation (verbatim where possible)

### IRC §7216(a) — General Rule

> "Any person who is engaged in the business of preparing... returns... and who knowingly or recklessly — (1) discloses any information furnished to him for, or in connection with, the preparation of any such return, or (2) uses any such information for any purpose other than to prepare, or assist in preparing, any such return, shall be guilty of a misdemeanor, and, upon conviction thereof, shall be fined not more than $1,000 ($100,000 in the case of a disclosure or use to which section 6713(b) applies), or imprisoned not more than 1 year, or both, together with the costs of prosecution."

Key statutory features: (a) **criminal**, not civil; (b) **knowingly or recklessly** standard — strict liability is not required, but recklessness is; (c) **disclosure OR use** — both verbs are independently prohibited; (d) **$100,000** cap when tied to identity-theft crimes.

### IRC §7216(b) — Exceptions

The statute itself permits three categories: (1) disclosures pursuant to other IRC provisions or court order; (2) use of information in preparing state/local tax returns; (3) "disclosures or uses... permitted by regulations prescribed by the Secretary." Category (3) is the vehicle for Treas. Reg. §301.7216-2 and -3.

### IRC §6713 — Civil Penalty Companion

§6713 imposes a parallel **civil** penalty: **$250 per unauthorized disclosure or use, capped at $10,000 per calendar year** (standard tier). The identity-theft tier raises this to **$1,000 per violation, capped at $50,000/year**. §6713 applies **in addition to** §7216 criminal penalties. The two operate on the same conduct.

### Treas. Reg. §301.7216-1 — Definitions

- **"Tax return preparer"**: "Any person who is engaged in the business of preparing or assisting in preparing tax returns" or "providing auxiliary services in connection with the preparation of tax returns." Critically, this sweeps in software developers, e-file providers, **and any contractor receiving tax return information for auxiliary services**.
- **"Tax return information"**: "Any information... which is furnished in any form or manner for, or in connection with, the preparation of a tax return of the taxpayer," including taxpayer name, address, SSN, and any information derived from tax return data.
- **"Disclosure"**: "The act of making tax return information known to any person in any manner whatever." (This is the broadest possible definition — copying a prompt into a chat box is a disclosure.)
- **"Use"**: "Any circumstance in which a tax return preparer refers to, or relies upon, tax return information as the basis to take or permit an action."

The regulation does **not** define "third-party service provider" as a single term — instead it operates through "auxiliary services" + contractor language in §301.7216-2(c), (d), (n), and the related examples.

---

## 2. The "Third-Party Service Provider" Carve-Out

### Important Note on Subsection Numbering

The user's task referenced "§301.7216-2(b)(6)" as the third-party carve-out. **This subsection citation appears to be incorrect in the current eCFR codification.** Subsection (b) addresses disclosures to the IRS only. The functional third-party service provider carve-out lives in:

- **§301.7216-2(c)** — disclosures within the same firm/in the US for tax preparation or auxiliary services
- **§301.7216-2(d)(1)** — disclosures to other US preparers for non-substantive assistance
- **§301.7216-2(d)(2)** — **the contractor / equipment & software carve-out (this is the one that matters for Docket's tech stack)**

(Older sub-regulatory guidance and some practitioner articles refer to "the (d)(2) carve-out" or "the auxiliary services exception." The user's "(b)(6)" reference may be conflating versions or a typo — what they're describing is the (d)(2) contractor exception.)

### §301.7216-2(d)(2) — The Contractor / Equipment & Software Carve-Out (Verbatim)

> "A tax return preparer may disclose tax return information to a person under contract with the tax return preparer in connection with the programming, maintenance, repair, testing, or procurement of equipment or software used for purposes of tax return preparation only to the extent necessary for the person to provide the contracted services, and only if the tax return preparer ensures that all individuals who are to receive disclosures of tax return information receive a written notice that informs them of the applicability of sections 6713 and 7216 to them and describes the requirements and penalties of sections 6713 and 7216."

> "Contractors receiving tax return information pursuant to this section are tax return preparers under section 7216 because they are performing auxiliary services in connection with tax return preparation."

### What this means in practice

1. **No client consent required** under (d)(2) if Docket's processor is performing "programming, maintenance, repair, testing, or procurement of equipment or software used for purposes of tax return preparation."
2. **Written §6713/§7216 notice** is required, given to "all individuals" at the contractor who will receive tax return information.
3. The contractor **itself becomes a §7216 tax return preparer**, inheriting all the same prohibitions and penalties.
4. The exception is **narrow** — it covers infrastructure and software, not substantive tax advice.

### What counts as a "Third-Party Service Provider"

Based on the regulation text and IRS examples, a covered contractor includes:
- Software development / SaaS hosting / cloud infrastructure
- Equipment procurement, maintenance, repair
- Software testing and QA
- Data transmission / e-file transmitters (separately covered by other subsections)
- Document storage and retrieval systems

Things the carve-out does **not** cover and that require explicit consent:
- Anyone making "substantive determinations or advice affecting the tax liability reported" — even US preparers (§301.7216-2(d)(1) only covers non-substantive disclosure to other preparers)
- Marketing firms (no carve-out — always needs consent under §301.7216-3)
- Banks/lenders receiving returns (always needs consent)
- Offshore contractors of any kind (consent required — see §3 below)
- Use of data for cross-sell, lead generation, advisory services, or financial-product solicitation

### Required Contractual Provisions

§301.7216-2(d)(2) only requires "written notice" of §6713/§7216 applicability — it does **not** by its own terms require a full contract with security safeguards, audit rights, sub-processor controls, breach notification, etc.

**However**, two parallel frameworks impose those contractual safeguards:

1. **FTC Safeguards Rule (16 CFR Part 314)** — under GLBA, tax preparers are "financial institutions" and **must**: (a) select service providers that can maintain appropriate safeguards, (b) require those safeguards by contract, and (c) oversee the service provider. This effectively mandates a DPA-style agreement with each processor.
2. **AICPA Rule 1.700.040** — for AICPA members, a contract requiring confidentiality is required as an alternative to client consent. AICPA Rule is **stricter** than §7216 because §7216 alone permits the (d)(2) carve-out without a contract, just a notice.

The practical answer: **always sign a DPA or its equivalent**. Per Pub 4557, the contract must require the provider to maintain "appropriate safeguards" and Docket must "oversee" the provider's handling.

### Audit / Inspection Rights

The regulation does not impose specific audit rights on the preparer. Pub 4557 and the FTC Safeguards Rule require **oversight** but don't prescribe a form. Sub-processor audit rights are typically obtained through DPAs (Anthropic's DPA, AWS DPA, etc.).

### Per-Processor Naming

§301.7216-2(d)(2) does **not** require disclosing the processor list to clients — that's the whole point of the carve-out. **But** when consent is required (e.g., for substantive AI determinations or offshore), Rev. Proc. 2013-14 §5.04 requires identifying the **specific recipient or recipients** of the tax return information. "Various AI tools" or "our technology partners" is insufficient — you must name each: Anthropic PBC, Amazon Web Services Inc., Composio AI Inc., etc.

### Annual Disclosure to Clients

The regulation does **not** require an annual processor-list disclosure to clients. Consents default to **one year** if no duration is specified (Treas. Reg. §301.7216-3(b)(5)(i)). Many firms include processor disclosures in the annual engagement letter regardless, as a defensive measure.

---

## 3. When Explicit Consent IS Required

Use the test: **Is the disclosure or use covered by any subsection of §301.7216-2?** If not, full §301.7216-3 consent applies.

| Scenario | Consent required? | Authority |
|----------|-------------------|-----------|
| Cloud hosting / SaaS infrastructure (US) | No — (d)(2) carve-out | §301.7216-2(d)(2) |
| AWS Bedrock inference (US region) | No — (d)(2), if Docket uses it purely as infrastructure | §301.7216-2(d)(2); written notice required |
| AI tool making substantive return decisions | **Yes** — substantive determinations are not covered by (d) | §301.7216-2(d)(1); Rev. Proc. 2013-14 |
| Offshore disclosure (any kind) | **Yes** — separate consent + special language | §301.7216-2(c)(3); Rev. Proc. 2013-14 §5.04(1)(c)(ii) |
| SSNs offshore | **Yes** + adequate data protection safeguards | Rev. Proc. 2013-14; SOC 2 or PMF required |
| Marketing / cross-sell | **Yes** — never covered by any (b) carve-out | §301.7216-3 |
| Advisory / wealth management / financial product | **Yes** — substantive non-tax use | §301.7216-3 |
| Bank / lender receiving forms | **Yes** | §301.7216-3 |
| List solicitation for tax services only | No — (n) carve-out for limited fields | §301.7216-2(n) |
| List solicitation for non-tax services | **Yes** | §301.7216-3 |
| Disclosure to outside attorney for legal advice | No — (g) carve-out | §301.7216-2(g) |
| Statistical compilations (10+ returns, anonymous) | No — (o) carve-out | §301.7216-2(o) |

### The Offshore Question (Critical for Docket)

§301.7216-2(c)(3) and Rev. Proc. 2013-14 jointly impose three layers for **any** offshore disclosure:

1. **Written consent** prior to disclosure (cannot be retroactive).
2. **Mandatory language**: "This consent to disclose may result in your tax return information being disclosed to a tax return preparer located outside the United States, including [country], where the laws may be different and federal agencies may not be able to enforce U.S. laws protecting the privacy of tax return information."
3. **If SSNs leave the US**: an "adequate data protection safeguard" must be in place — Rev. Proc. 2013-14 §6 lists six acceptable frameworks. SOC 2 Type II and AICPA Privacy Management Framework (PMF) are the most-cited.

The Treasury's example in §301.7216-2 explicitly contemplates cloud-server scenarios: a US-based server accessed by a foreign contractor through password-protected view-only software still constitutes an offshore disclosure requiring consent.

**Application to Docket's stack:**
- Anthropic API inference runs in Anthropic's infrastructure (currently US-based with regions in EU/UK for some products). If Docket exclusively uses US endpoints, no offshore consent needed under (d)(2). **But if any Anthropic processing flows through non-US regions, offshore consent is triggered.**
- AWS Bedrock fall-over: same analysis — only US AWS regions stay inside (d)(2).
- Cohere rerank: Cohere has US and Canadian inference. **Canada is offshore.** If Cohere's data goes through any non-US region, offshore consent rules trigger.
- Composio (OAuth gateway): if Composio's infrastructure is US-only, (d)(2) covers it. Otherwise, offshore consent.
- Fly.io browser automation: deployed in chosen regions — pin to US regions to stay inside (d)(2).

### Multi-State Implications

The IRC and Treas. Reg. apply uniformly across all 50 states. However, **state-level privacy laws may impose additional consent requirements** — California CCPA/CPRA, Virginia VCDPA, Colorado CPA, Connecticut CTDPA, and Utah UCPA all impose their own notice and consent rules on processors of "personal information," and several states require explicit opt-in for "sensitive personal information" which includes tax data. New York's SHIELD Act and Massachusetts 201 CMR 17 add data-security requirements. Some states (e.g., California's CPRA) require disclosure of all "service providers" and "contractors" in a privacy notice.

For Docket, the safest path is a single nationwide consent that satisfies §7216 + Rev. Proc. 2013-14 (the strictest federal floor) plus a comprehensive privacy notice that names every processor (covering state-law obligations).

---

## 4. Consent Format Requirements

### Rev. Proc. 2013-14 §5.04 — Mandatory Elements

A valid consent under §301.7216-3 + Rev. Proc. 2013-14 must:

1. **Identify the preparer** by name.
2. **Identify the taxpayer** by name.
3. **State the intended purpose** of the disclosure or use.
4. **Identify the specific recipient(s)** (a "descriptive class of entities" is allowed only in narrow circumstances per §301.7216-3(a)(3)(i)(D)).
5. **Specify the tax return information** to be disclosed or used.
6. Be **signed and dated** by the taxpayer.
7. For 1040-series taxpayers, include the **mandatory verbatim language**: "Federal law requires this consent form be provided to you. Unless authorized by law, we cannot disclose your tax return information to third parties for purposes other than the preparation and filing of your tax return without your consent. If you consent to the disclosure of your tax return information, Federal law may not protect your tax return information from further use or distribution."
8. Include **revocation rights** — clients can withdraw at any time.
9. For 1040 series **paper** consents: 12-point type minimum, adequate contrast, separate document (not buried in engagement letter).
10. For 1040 series **electronic** consents: displayed on its own screen with adequate contrast, in same or larger size than the surrounding text, affirmative (opt-in) selection.

### "Knowing and Voluntary" Standard

Treas. Reg. §301.7216-3(a)(1): consent must be "knowing and voluntary." Critically: **"conditioning the provision of any services on the taxpayer's furnishing consent will make the consent involuntary, and the consent will not satisfy the requirements of this section"** — except when the service being conditioned is tax preparation assistance from another preparer (the only narrow exception).

For Docket, this means: you cannot refuse to onboard a client just because they refuse AI-tool consent. The fallback must be a non-AI workflow, even if degraded.

### Electronic Signatures

Rev. Proc. 2013-14 §4.06 explicitly permits electronic consents. Requirements:
- The electronic signature must "uniquely identify" the taxpayer.
- The form must be displayed in compliant electronic format.
- The taxpayer must affirmatively consent (no pre-checked boxes).
- A copy must be provided to the taxpayer at the time of execution.
- DocuSign, HelloSign, and equivalent ESIGN-compliant platforms are acceptable; the IRS does not endorse specific vendors but accepts ESIGN/UETA-compliant signatures.

### Annual Renewal vs Per-Engagement

- **Default duration**: 1 year from the date the taxpayer signed (§301.7216-3(b)(5)(i)).
- **Maximum duration**: indefinite, but if no end date is stated, defaults to 1 year. A consent may state a longer duration explicitly.
- **Per-engagement is safer**: many firms refresh consents annually as part of the engagement letter cycle, because it tracks Rev. Proc.'s anti-stale-consent intent.
- **Revocation**: client may revoke at any time. The preparer must "immediately cease" disclosures upon revocation. Docket must maintain a revocation log and a kill-switch.

### Recordkeeping

Neither §301.7216 nor Rev. Proc. 2013-14 specifies an exact retention period for the **consent forms themselves**. The relevant retention anchors are:

- **§6107(b)** — preparer must retain a copy of return or list of clients for 3 years (the preparer-recordkeeping baseline).
- **IRS examination period** — usually 3 years, extended to 6 years for substantial understatements, indefinite for fraud.
- **FTC Safeguards Rule** — does not specify a retention period for consents but requires ongoing oversight documentation.
- **Practical floor**: **7 years** is the industry consensus for consent-form retention, matching the longest plausible examination + statute-of-limitations window.

For Docket, retain consents for **at minimum 7 years** from the later of: (a) the date of the consent, (b) the date of revocation, (c) the date of the tax return to which the consent relates.

---

## 5. AI / Cloud Third-Party Specifics

### IRS Guidance on AI

As of May 2026, the IRS has issued **no specific guidance on AI/LLM use under §7216**. The Section 7216 Information Center on irs.gov (last reviewed September 2025) does not address AI or LLM processors. The regulation predates modern LLMs by 15+ years and was last meaningfully updated in 2008.

Practitioner consensus (Tom Talks Taxes Mar 2026, Compass Tax Educators Mar 2026, TaxProExchange 2025) holds that:

1. **Public consumer AI (ChatGPT, Claude.ai chat, Gemini, Perplexity) is off-limits** without specific consent — pasting tax data into these tools is a §7216 disclosure the moment it leaves the preparer's control.
2. **Enterprise AI with DPA + no-training + tenant isolation + logging** can fit within (d)(2) as software/equipment if the AI is doing infrastructure-grade work (transcription, document classification, OCR) — but **substantive return decisions push it back to consent-required territory**.
3. **Sanitization (removing names/SSNs) helps but is not a safe harbor.** If remaining details could reasonably identify the taxpayer, it's still tax return information.
4. **Specific recipient naming** is mandatory in any consent — "various AI tools" or "our technology partners" fails Rev. Proc. 2013-14.

### Anthropic's §7216 Posture

Anthropic publishes a DPA (privacy.claude.com) automatically incorporated into Commercial Terms of Service:

- **SOC 2 Type II** annual audit (trust.anthropic.com).
- **HIPAA BAA** available (Cleveland Clinic case study confirms).
- **Zero data retention** option for Claude API customers (must be requested; default is 30-day retention for safety review).
- **No training on customer API data** by default for commercial customers.
- **Breach notification**: 48 hours.
- **Standard Contractual Clauses** for non-US transfers.
- **Anthropic does not market a §7216-specific BAA-equivalent.** No public document specifically references §7216 compliance.

For Docket, the operational requirements: (a) sign Commercial Terms (which incorporates DPA); (b) **request zero-retention** for API calls carrying tax data; (c) confirm endpoints stay in US regions; (d) give Anthropic the §6713/§7216 written notice required by §301.7216-2(d)(2); (e) name Anthropic in any consent form where substantive AI use is anticipated.

### AWS Bedrock

AWS publishes a comprehensive DPA, SOC 1/2/3, ISO 27001, FedRAMP Moderate (and High for GovCloud), HIPAA BAA, and PCI DSS. Bedrock specifically: no customer-data training, regional model invocations, customer-managed encryption keys. AWS does not publish §7216-specific posture but its DPA + BAA framework satisfies the FTC Safeguards Rule's service-provider oversight requirement.

Operationally: pin Bedrock invocations to US regions (us-east-1, us-west-2, etc.); enable CloudTrail for audit logging; deliver §6713/§7216 written notice to AWS (typically by attaching it to the AWS DPA addendum).

### Other Processors in Docket's Stack

| Processor | §7216 posture | Required action |
|-----------|---------------|-----------------|
| **Composio** | OAuth gateway — handles tokens, not tax content directly. (d)(2) covers if pure infrastructure. | §6713/§7216 written notice; DPA |
| **Twilio** | SMS may carry tax content (reminders with amounts, etc.). (d)(2) covers as software/equipment. Verify US-only routing. | §6713/§7216 notice; DPA; restrict content to non-tax-data |
| **DocuSign** | E-signature; envelopes may contain returns. Already widely accepted as §7216-compliant (e-file ecosystem standard). | DPA; §6713/§7216 notice; envelope content audit |
| **Square** | Payment processing — bank/payment data is **not** tax return information per §301.7216-1, but if used to process tax-prep fees collected with return data attached, (d)(2) applies. | DPA; isolate payment context from return content |
| **Vercel** | Hosting infra. (d)(2) covers. | DPA; US regions; §6713/§7216 notice |
| **Neon** | Postgres hosting — stores tax data at rest. (d)(2) covers. | DPA; US regions; encryption at rest; §6713/§7216 notice |
| **Cloudflare R2** | Object storage — likely stores documents containing tax information. (d)(2) covers. | DPA; pin to US jurisdictions; §6713/§7216 notice |
| **Fly.io** | Browser automation — touches client portals carrying tax info. (d)(2) covers if US-region. | DPA; US regions only; §6713/§7216 notice |
| **Cohere** | Rerank — touches embeddings/snippets derived from tax data. Canadian/US regions; **if Canadian routing, offshore consent applies**. | DPA; pin to US region only OR get explicit consent + offshore disclosure language |

### §7216 Audits — How the IRS Enforces

IRS enforcement of §7216 historically operates through three channels: (1) **criminal referral** to DOJ Tax Division (rare — fewer than a handful of reported prosecutions in the last decade); (2) **§6713 civil penalty assessment** by the Return Preparer Office; (3) **OPR referral** for Circular 230 disciplinary action (suspension/disbarment from IRS practice). OPR sanctions are published in the Internal Revenue Bulletin.

OPR's August 2025 alert ("Fessing Up Can Be in Your Own Best Interests") emphasized self-reporting of practitioner misconduct, including §7216 violations. OPR continues to actively administer §7216 referrals.

### Recent High-Profile Episodes

- **2022 Markup investigation**: TaxSlayer, H&R Block, and TaxAct were revealed to be transmitting taxpayer financial data to Meta (Facebook Pixel) and Google. Estimated tens of millions of returns affected.
- **June 2023 Congressional Report** ("Attacks on Tax Privacy"), led by Sen. Warren and others, formally alleged §7216 violations and urged DOJ/IRS prosecution.
- **TIGTA investigation requested** (Schiff letter; ongoing).
- **As of May 2026, no completed criminal prosecution has been reported** from these incidents, though §6713 civil penalty referrals are believed to be in progress.

The takeaway: §7216 enforcement is rare but enforcement attention on tech-mediated leakage is **rising sharply**. AI tools are next.

---

## 6. Audit Packaging Requirements

For each tax engagement, Docket should retain (per the integrated §7216 + §6107 + FTC Safeguards + state-law framework):

### Per-Client Audit Bundle

1. **Signed consent forms** (all of them) — with timestamps, cryptographic signature hashes, IP addresses, browser fingerprints. Retain for **7 years** minimum.
2. **The processor list at time of consent** — snapshot of the active processor inventory the client consented to. Versioned.
3. **Audit trail of data flow** — for each piece of tax return information, which processors touched it, when, with what scope. This is the chain-of-custody log.
4. **Revocation log** — any revocation request, when received, when honored, what processors were ceased.
5. **§6713/§7216 written notices** delivered to each processor — copies retained as evidence of (d)(2) compliance.
6. **DPAs / sub-processor agreements** with each processor — current and historical versions.

### Firm-Wide Retention

7. **WISP (Written Information Security Plan)** per IRS Pub 5708/5709 and FTC Safeguards Rule. Annually reviewed.
8. **Service provider oversight records** — periodic reviews of each processor's safeguards (SOC 2 reports, breach history, etc.).
9. **Breach notification records** — any "notification event" under FTC Safeguards Rule (effective May 13, 2024, breaches affecting 500+ consumers must be reported to FTC).
10. **Staff training records** — §7216 and Pub 4557 awareness training.

### Retention Periods

| Document type | Minimum retention |
|---------------|-------------------|
| Signed consent forms | 7 years from latest of: consent date, revocation, related return year |
| Processor disclosure list snapshots | 7 years (matched to consents) |
| Data-flow audit logs | 7 years (matched to returns) |
| §6713/§7216 written notices to processors | Duration of contract + 7 years |
| DPAs / SP contracts | Duration of contract + 7 years |
| Tax returns / return lists | 3 years (§6107(b)) — but 7 years industry standard |
| WISP versions | 7 years |
| Breach records | 7 years (industry standard); 6 years for FTC enforcement statute |

### Integration with Docket's Audit Chain

Per CLAUDE.md L9 (audit chain load-bearing): each event in the tax-data lifecycle (intake → AI prompt → AI response → human review → finalization → e-sign → e-file) should write a structured event into the audit log with: (a) timestamp; (b) data hash; (c) processor(s) touched; (d) consent reference; (e) actor (human or system). The §7216 audit bundle is a query over this log filtered by client + date range.

---

## 7. Penalty Structure + Enforcement

### Statutory Penalty Stack

| Statute | Type | Per violation | Annual cap | Trigger |
|---------|------|---------------|------------|---------|
| **§7216(a)** | Criminal misdemeanor | $1,000 + up to 1 year imprisonment | None | Knowing/reckless disclosure or use |
| **§7216(a) (identity-theft tier)** | Criminal | $100,000 + up to 1 year imprisonment | None | §6713(b) identity-theft connection |
| **§6713(a)** | Civil | $250 | $10,000 | Any unauthorized disclosure or use |
| **§6713(b)** | Civil | $1,000 | $50,000 | Identity-theft connection |
| **§6694(a)** | Civil | greater of $1,000 or 50% of fees | None | Understatement from unreasonable position |
| **§6694(b)** | Civil | greater of $5,000 or 50% of fees | None | Willful/reckless conduct |
| **Aggregate cap on preparer penalties** | — | — | $25,500 | Cross-section cap per calendar year |

### Penalty Stacking Mechanics

§7216 (criminal) and §6713 (civil) **stack** — they apply to the same underlying conduct. A single disclosure violation can yield: (a) DOJ criminal prosecution under §7216, plus (b) a §6713 civil assessment, plus (c) OPR Circular 230 sanctions (suspension/disbarment), plus (d) potential §6694 if the disclosure flowed from an unreasonable position. §6695 may also apply for specific signature/identification failures.

### Real Enforcement Cases

- **United States v. Cwiklinski** (E.D.N.Y. 2009) — preparer prosecuted under §7216 for selling client lists. Resulted in conviction and prison sentence.
- **United States v. Mosko** and several smaller §7216 prosecutions (~2010-2018) — typically tied to data sale to marketing/loan firms.
- **OPR Bulletin announcements** (IR Bulletin, monthly) — recurring §7216-related disciplinary sanctions, typically suspensions from IRS practice for repeated disclosure violations.
- **2022-2023 Markup/Congressional referrals** — pending; no completed prosecutions as of May 2026.

### What Triggers Enforcement

In practice, IRS Criminal Investigation and DOJ Tax look at §7216 cases when (a) data was sold for commercial gain, (b) identity theft connection exists, (c) systematic disclosure to a single non-permitted recipient (e.g., a particular marketing firm), or (d) the disclosure made the press. OPR triggers more frequently — typically on complaint or examination findings.

---

## 8. Template Language for Docket

The following templates are **drafts adapted from Rev. Proc. 2013-14 §5.04 mandatory language plus AICPA sample forms**. They are starting points and require review by Docket's tax counsel before deployment.

### Template A — §6713/§7216 Written Notice to Processors

**(Required under §301.7216-2(d)(2). Deliver to each processor's compliance contact at contract execution.)**

> **Notice of Applicability of Sections 6713 and 7216 of the Internal Revenue Code**
>
> Docket, Inc. ("Docket") is a tax return preparer subject to Internal Revenue Code Sections 6713 and 7216 and Treasury Regulation §301.7216. In the course of providing services to Docket pursuant to our agreement dated [DATE], you and your personnel may receive "tax return information" as defined in Treas. Reg. §301.7216-1(b)(3).
>
> Pursuant to Treas. Reg. §301.7216-2(d)(2), you and each of your individuals who receive tax return information are hereby notified that:
>
> 1. **§7216** prohibits any tax return preparer (which now includes you and your personnel for purposes of this engagement) from knowingly or recklessly disclosing any tax return information furnished in connection with the preparation of a return, or using such information for any purpose other than preparing or assisting in preparing a return. Violation is a **federal misdemeanor**, punishable by a fine of up to $1,000 (or $100,000 if connected to identity theft) and/or imprisonment up to 1 year.
>
> 2. **§6713** imposes a civil penalty of $250 per unauthorized disclosure or use, capped at $10,000 per calendar year ($1,000 / $50,000 in identity-theft contexts).
>
> 3. **You may use tax return information only to the extent necessary** to provide the contracted services and may not retain, share, or use it for any other purpose.
>
> Please confirm receipt of this notice and distribute it to all personnel who will receive tax return information from Docket.
>
> Signed: [Docket Officer]
> Date: [DATE]

### Template B — Multi-Processor Disclosure Consent (Client-Facing, 1040 Series)

**(For substantive AI use, marketing, advisory cross-sell, or any non-(d)(2)-covered processor relationship. Must be on its own screen/page, 12-point minimum, affirmative checkboxes per item.)**

> **CONSENT TO DISCLOSE TAX RETURN INFORMATION TO THIRD-PARTY SERVICE PROVIDERS**
>
> Federal law requires this consent form be provided to you. Unless authorized by law, we cannot disclose your tax return information to third parties for purposes other than the preparation and filing of your tax return without your consent. If you consent to the disclosure of your tax return information, Federal law may not protect your tax return information from further use or distribution.
>
> You are not required to complete this form to engage our services. Your consent is voluntary. If we obtain your signature on this form by conditioning our tax preparation services on your consent, your consent will not be valid. Your consent is valid for the amount of time that you specify. If you do not specify the duration of your consent, your consent is valid for one year from the date of signature.
>
> By checking the box(es) below and signing, you (the taxpayer, [TAXPAYER NAME]) authorize Docket, Inc. ("Docket") to disclose the tax return information specified to the listed third parties for the stated purposes:
>
> ☐ **AI-assisted return processing.** I authorize Docket to disclose my tax return information (including names, identifying numbers, income, deductions, and supporting documents) to **Anthropic PBC** and **Amazon Web Services, Inc.** for the purpose of generating draft tax positions, summarizing source documents, and supporting return preparation through automated language-model processing. These providers are bound by Docket's data processing agreements and will not train on or retain this data beyond Docket's instructions.
>
> ☐ **Document automation and e-signature.** I authorize Docket to disclose my tax return and supporting forms to **DocuSign, Inc.** for electronic signature processing.
>
> ☐ **OAuth and third-party data retrieval.** I authorize Docket to disclose connection and authentication information to **Composio AI, Inc.** for the purpose of retrieving documents from financial institutions and payroll providers on my behalf.
>
> ☐ **Voice and messaging communications.** I authorize Docket to disclose my contact information and tax-related communication content to **Twilio, Inc.** for the purpose of sending status notifications and reminders.
>
> ☐ **Hosting and storage infrastructure.** I authorize Docket to store and process my tax return information using **Vercel, Inc.** (application hosting), **Neon, Inc.** (database hosting), and **Cloudflare, Inc.** (object storage). All such storage occurs within the United States.
>
> **Duration:** This consent is valid for one year from the date of signature unless I specify a different duration here: ____________________________.
>
> **Revocation:** I may revoke this consent at any time by emailing privacy@docket.com or by written notice to Docket. Revocation will be effective immediately upon receipt.
>
> **Complaints:** If you believe your tax return information has been disclosed or used improperly in a manner unauthorized by law or without your permission, you may contact the Treasury Inspector General for Tax Administration (TIGTA) by telephone at 1-800-366-4484, or by email at complaints@tigta.treas.gov.
>
> **Taxpayer signature:** _______________________________
> **Date:** _____________________
> **Spouse signature (if MFJ):** _______________________________
> **Date:** _____________________

### Template C — Offshore Disclosure Consent (If Any Processor Routes Through Non-US)

> **CONSENT TO DISCLOSE TAX RETURN INFORMATION OUTSIDE THE UNITED STATES**
>
> [Mandatory 1040 preamble — same as Template B preamble]
>
> ☐ **Offshore processing notice.** I authorize Docket, Inc. to disclose my tax return information (excluding my Social Security Number) to [Processor Name and Country]. This consent to disclose may result in my tax return information being disclosed to a tax return preparer located outside the United States, where the laws may be different and federal agencies may not be able to enforce U.S. laws protecting the privacy of tax return information.
>
> [If SSNs are included, additional consent with full SSN-offshore language per Rev. Proc. 2013-14 §5.04(1)(c) and adequate data protection safeguard documentation.]
>
> [Signatures, date, revocation, complaint language — same as Template B]

### Should Consents Be Per-Processor or Combined?

**Combined is permissible** under Rev. Proc. 2013-14 §5.04(2), which requires that the taxpayer be able to "affirmatively select each separate disclosure or use." This means a single form is OK if it has separate affirmative checkboxes for each disclosure category. **Bundled (single checkbox for all)** is not permitted — it would be treated as a non-affirmative opt-out and invalidate the consent.

Practical recommendation for Docket: **one consent form, multiple affirmative checkboxes, one per processor category** (AI processing, e-signature, OAuth/retrieval, communications, hosting). Group "infrastructure-only" (d)(2)-covered processors together because they technically don't need consent, but disclosing them on the form is good practice for state-law transparency.

---

## 9. GLBA / FTC Safeguards Interaction

### Tax Preparers as Financial Institutions

Under the **Gramm-Leach-Bliley Act**, tax preparers are "financial institutions" because tax preparation is a "financial activity" listed under 12 CFR §225.86. This brings them under:

- **GLBA Privacy Rule** (15 USC §§6801-6809) — administered by the FTC for non-bank institutions.
- **FTC Safeguards Rule** (16 CFR Part 314) — comprehensive information-security program.
- **GLBA Pretexting Rule** — prohibits obtaining customer information through pretext.

### FTC Safeguards Rule Requirements (Tax-Specific)

Per IRS Pub 4557 and the Safeguards Rule (as amended December 2021, effective June 2023; breach-notification update effective May 13, 2024):

1. **Designate a Qualified Individual** to oversee the security program.
2. **Risk assessment** — at least annually.
3. **Safeguards**:
   - Access controls (MFA mandatory)
   - Data inventory and classification
   - Encryption (at rest and in transit; transitional alternatives only if certified)
   - Secure development practices
   - Multi-factor authentication
   - Secure data disposal (within 2 years of last use, with exceptions)
   - Change management
   - Monitoring and logging
4. **Service provider oversight** — select providers capable of safeguarding customer information, require safeguards by contract, periodically assess providers.
5. **Written Information Security Plan (WISP)** documenting all of the above.
6. **Penetration testing** annually + vulnerability assessments every 6 months (or continuous monitoring).
7. **Incident response plan** in writing.
8. **Board reporting** annually.
9. **Notification event reporting** (effective May 13, 2024): notify FTC within 30 days of any unauthorized acquisition of unencrypted customer info affecting 500+ consumers.

### §7216 vs FTC Safeguards — How They Interact

| Topic | §7216 | FTC Safeguards |
|-------|-------|----------------|
| Scope | Tax return information | All "customer information" |
| Primary mechanism | Disclosure prohibition + consent | Security program + safeguards |
| Service-provider rule | Carve-outs in §301.7216-2; consent in §301.7216-3 | Oversight + contract + monitoring |
| Penalty | Criminal + civil + OPR | FTC enforcement actions + state AG referrals |
| Breach notification | None directly | 30 days to FTC for 500+ events |

**They are complementary, not duplicative.** §7216 governs **what you can disclose**; Safeguards Rule governs **how you must protect what you do disclose**. A processor relationship must satisfy both — the §301.7216-2(d)(2) carve-out gets you past the consent question, but Safeguards Rule still requires you to oversee that processor with a contract and audit.

### BAA Equivalents for Tax Data

There is **no HIPAA equivalent BAA mandated for tax data**, but the practical equivalent is a **DPA + §6713/§7216 written notice + (often) AICPA Privacy Management Framework compliance**. Anthropic, AWS, DocuSign, Twilio, Vercel, Neon, Cloudflare, Fly.io, and Cohere all offer DPAs. The §6713/§7216 written notice (Template A above) is the §7216-specific addition.

### State-Level Layers

- **California CPRA** — tax data is "sensitive personal information"; explicit opt-in for use of SPI for purposes beyond strictly necessary.
- **NY SHIELD Act** — security program for any business handling NY residents' personal info.
- **MA 201 CMR 17.00** — written info-security program with similar requirements to FTC Safeguards.
- **Many states** have CPA-licensee confidentiality rules that mirror or exceed AICPA Rule 1.700.

---

## 10. Recommendations for Docket

### V1 Consent Flow Design

1. **Onboarding flow** presents Template B (multi-processor consent) as a separate step after engagement letter acceptance, before any AI tool touches client data.
2. **Affirmative opt-in per category** — not bundled, not opt-out. Five to seven checkboxes minimum.
3. **Default duration: 1 year**, with renewal prompt at engagement-year boundary.
4. **Revocation UI** — single-click revocation in client portal, with audit log entry and immediate processor-side kill switch.
5. **Fallback non-AI workflow** — clients who decline AI consent must still be onboardable. Required to preserve "voluntary" element.
6. **Offshore consent (Template C) gated by processor configuration** — only shown if any processor is configured to non-US region. Default: all processors US-only.

### Processor List Management

1. **Single source of truth** in Docket's config (e.g., `processors.json` or DB table) listing each processor, version of DPA in effect, regions enabled, scope of data, §6713/§7216 notice delivery date.
2. **Versioned snapshots** — when a client signs a consent, freeze a snapshot of the processor list at that timestamp and store with the consent record.
3. **Processor addition workflow** — adding a new processor (e.g., Cohere) requires: (a) DPA in place, (b) §6713/§7216 notice delivered, (c) regional configuration locked to US, (d) decision whether existing consents cover or new consent needed, (e) audit-chain registration.
4. **Annual processor review** — match firm-wide Safeguards Rule annual review.

### Audit Packaging

1. **Per-return audit bundle** generated on demand: signed consent, processor snapshot, full data-flow log filtered to that return, revocation status, all processor §6713/§7216 notices.
2. **Cryptographic chaining** — append-only audit log with hash chain (Merkle-style), so any tampering is detectable post hoc. This addresses CLAUDE.md L9 ("audit chain load-bearing").
3. **Storage**: encrypted at rest in Neon (or dedicated audit-log store), retention 7 years minimum.
4. **Export format**: PDF bundle suitable for OPR/IRS examination submission.

### Audit-Chain Integration

Each event that touches tax return information should emit:
```
{ts, actor, processor, scope, dataHash, consentId, ruleBasis, parentHash}
```
where `ruleBasis` is either `(d)(2)` (covered by carve-out) or `consent:{id}` (covered by signed consent). This allows the audit bundle to compute per-record compliance posture deterministically.

### Specific Configuration Recommendations

- **Anthropic**: enable zero-retention API mode; pin to US regions; sign DPA + send Template A notice.
- **AWS Bedrock**: us-east-1 / us-west-2 only; CloudTrail on; KMS-managed keys; sign DPA + Template A notice.
- **Cohere**: pin to US region (not Canadian); if Canada-only available for any model, require explicit offshore consent under Template C.
- **All other processors**: US regions only by default; DPAs signed; Template A notices delivered; tracked in processor manifest.

### Operational Guardrails

1. **Block public consumer AI** (claude.ai, chat.openai.com, gemini.google.com) at the network/extension level. Use enterprise APIs only.
2. **Pre-disclosure linting** — any AI prompt construction should check the consent state and processor scope before sending.
3. **Substantive determination guardrail** — if the AI is asked to make a "substantive determination" (filing status, deduction eligibility, treaty application), require human review + flag in audit log.
4. **Quarterly compliance review** — log sampling, consent revocation audit, processor list review.

---

## 11. Open Questions / Unverifiable Claims

1. **Exact §301.7216-2 subsection citation for the user's "(b)(6)"** — the user's task referenced this citation, but the actual third-party carve-out in the current eCFR is at **§301.7216-2(d)(2)**. Older versions or earlier drafts of the regulation may have used different lettering; the underlying substance is what's described above. **Action**: validate with tax counsel that (d)(2) is the operative provision intended.

2. **§301.7216-2(c) vs (d) split** — the regulation distinguishes between same-firm preparers (c) and other preparers (d), but the line between "infrastructure provider" and "preparer" for AI/cloud platforms is not directly addressed by the regulation. The 2008 IRS preamble to the final regulations suggests Treasury views contractors performing equipment/software services as **preparers** themselves (hence the §6713/§7216 notice requirement). **This means Anthropic and AWS are technically tax return preparers** when Docket sends them tax data — an unsettling but legally defensible interpretation.

3. **Whether AI inference constitutes "substantive determination"** — there is **no IRS guidance** distinguishing infrastructure-grade AI use (OCR, classification, summarization) from substantive-determination AI use (suggesting filing status, recommending deductions). Practitioner consensus (Tom Talks Taxes, Compass Tax Educators) is to **assume substantive when in doubt** and get consent. This is the most defensible posture for V1.

4. **Sub-processors of processors** — Anthropic uses AWS as a sub-processor; AWS Bedrock invokes Anthropic models. The chain of (d)(2) notice obligations down to sub-processors is unclear in the regulation. Most practitioners rely on the prime processor's DPA to flow obligations to sub-processors. **Conservative approach**: name material sub-processors in consent where known.

5. **Retention period for consent forms** — neither §301.7216 nor Rev. Proc. 2013-14 specifies a retention period. The 7-year industry consensus is empirical, not regulatory. **Could be shorter** under §6107(b)'s 3-year baseline; **could be longer** for fraud cases. 7 years is a defensible practical answer.

6. **Whether annual consent renewal is required** — the default 1-year duration is regulatory, but a longer-duration consent (signed once with multi-year effect) is permissible if explicit. Whether this satisfies the "knowing and voluntary" standard for forward-looking processor changes is **not directly addressed**.

7. **State-law overrides** — California CPRA, Connecticut CTDPA, Texas TDPSA, and others may impose stricter consent rules for "sensitive personal information." A single federal §7216-compliant consent likely satisfies most states but **not all** — particularly California's "limit use" right and Colorado's universal opt-out. Docket should layer state-specific consent on top where needed.

8. **§7216 enforcement against AI providers themselves** — if Anthropic or AWS were to misuse data, they are themselves §7216 preparers per §301.7216-2(d)(2). Whether the IRS would prosecute a cloud provider under §7216 is **untested**. The §6713 civil penalty is more likely.

9. **Whether the FTC Safeguards Rule notification event (500-consumer threshold) interacts with §7216 breach disclosure obligations** — there is **no §7216 breach notification requirement**. Federal disclosure obligations on breach come from FTC Safeguards (effective 2024-05-13) and state breach-notification statutes. §7216 governs the unauthorized-disclosure prohibition, not post-incident reporting.

10. **DocuSign and §7216** — DocuSign envelopes routinely contain returns. While generally treated as (d)(2) infrastructure, the IRS has not specifically addressed e-signature platforms. Industry practice treats them as covered.

11. **The user's "Anthropic's training data jurisdiction"** — Anthropic does not train on Commercial API customer data by default (per ToS + DPA). So training-data jurisdiction is **not a §7216 concern for properly configured API usage**. It would become a concern only for consumer-tier (claude.ai) use, which is independently prohibited for tax data.

---

## 12. Citations

**Primary law:**
- [IRC §7216 (Cornell LII)](https://www.law.cornell.edu/uscode/text/26/7216)
- [IRC §6713 (Cornell LII)](https://www.law.cornell.edu/uscode/text/26/6713)
- [IRC §6694 (Cornell LII)](https://www.law.cornell.edu/uscode/text/26/6694)
- [26 CFR §301.7216-1 — Definitions (Cornell LII)](https://www.law.cornell.edu/cfr/text/26/301.7216-1)
- [26 CFR §301.7216-2 — Permissible Disclosures Without Consent (Cornell LII)](https://www.law.cornell.edu/cfr/text/26/301.7216-2)
- [26 CFR §301.7216-3 — Disclosure or Use Permitted Only with Consent (Cornell LII)](https://www.law.cornell.edu/cfr/text/26/301.7216-3)
- [26 CFR §301.7216-2 (GovInfo 2025)](https://www.govinfo.gov/content/pkg/CFR-2025-title26-vol20/pdf/CFR-2025-title26-vol20-sec301-7216-2.pdf)

**IRS guidance:**
- [Rev. Proc. 2013-14 (IRS PDF)](https://www.irs.gov/pub/irs-drop/rp-13-14.pdf)
- [IRS Section 7216 Information Center](https://www.irs.gov/tax-professionals/section-7216-information-center)
- [IRS Publication 4557 — Safeguarding Taxpayer Data](https://www.irs.gov/pub/irs-pdf/p4557.pdf)
- [IRS Publication 5708 — Creating a WISP](https://www.irs.gov/pub/irs-pdf/p5708.pdf)
- [IRS Publication 5709 — How to Create a WISP](https://www.irs.gov/pub/irs-pdf/p5709.pdf)
- [IRS FAQs on Strengthened Taxpayer Control](https://www.irs.gov/newsroom/faqs-related-to-strengthened-taxpayer-control-over-tax-information)
- [IRS Office of Professional Responsibility](https://www.irs.gov/tax-professionals/office-of-professional-responsibility-and-circular-230)
- [OPR Self-Reporting Alert 2025-12](https://www.irs.gov/pub/opr-taxpros/2025-12.pdf)
- [Federal Register: 2008 §7216 Final Regulations Preamble](https://www.federalregister.gov/documents/2008/01/07/08-1/guidance-necessary-to-facilitate-electronic-tax-administration-updating-of-section-7216-regulations)
- [IRM 8.11.3 — Return Preparer Penalty Cases](https://www.irs.gov/irm/part8/irm_08-011-003)
- [IRM 20.1.6 — Preparer and Promoter Penalties](https://www.irs.gov/irm/part20/irm_20-001-006)

**Practitioner analysis:**
- [The Tax Adviser: The many implications of Sec. 7216 (Jan 2024)](https://www.thetaxadviser.com/issues/2024/jan/the-many-implications-of-sec-7216/)
- [CPA Journal: Considerations for Tax Return Preparers Outsourcing Overseas (Aug 2025)](https://www.cpajournal.com/2025/08/26/considerations-for-tax-return-preparers-outsourcing-overseas/)
- [CPA Journal: Getting Taxpayers' Consent under §7216 (Dec 2019)](https://www.cpajournal.com/2019/12/03/getting-taxpayers-consent-to-disclose-or-use-tax-return-information-under-irc-section-7216/)
- [Journal of Accountancy: AICPA's revised confidentiality rule and Sec. 7216 (Mar 2015)](https://www.journalofaccountancy.com/issues/2015/mar/aicpa-confidentiality-rule/)
- [AICPA Section 7216 Guidance & Sample Forms](https://www.aicpa-cima.com/resources/download/section-7216-guidance-and-sample-consent-forms)
- [Baker Newman Noyes: Disclosure Consent Forms Q&A](https://www.bnncpa.com/resources/disclosure-consent-forms-sec-7216-explained-qa/)
- [Credfino: 7 Myths Around §7216](https://credfino.com/blog/staffing/7-myths-around-section-7216-tax-preparer-rules/)
- [Thomson Reuters: Explaining the 7216 Consent Form](https://tax.thomsonreuters.com/blog/how-to-explain-the-7216-consent-form-to-your-clients/)
- [LegalClarity: Section 7216 Disclosure Rules](https://legalclarity.org/what-are-the-rules-under-irc-section-7216/)

**AI / §7216 specific:**
- [TaxProExchange: Tax Return Info Under §7216 & AI](https://www.taxproexchange.com/ai/7216)
- [Tom Talks Taxes: AI and the §7216 Disclosure and Use Rules (Mar 2026)](https://www.tomtalkstaxes.com/p/ai-7216)
- [Compass Tax Educators: AI and §7216 (Mar 2026)](https://compasstaxeducators.com/ai-and-the-%C2%A77216-disclosure-and-use-rules/)
- [Insightful Accountant: AI and Technology in Tax Practice](https://insightfulaccountant.com/tax-practice-news/ai-and-technology-in-tax-practice/)

**Anthropic / AWS posture:**
- [Anthropic Trust Center](https://trust.anthropic.com/)
- [Anthropic DPA Help Article](https://privacy.claude.com/en/articles/7996862-how-do-i-view-and-sign-your-data-processing-addendum-dpa)
- [Anthropic Subprocessors](https://trust.anthropic.com/updates)

**FTC Safeguards Rule:**
- [Bellator Cyber: FTC Safeguards Rule for Tax Preparers](https://bellatorcyber.com/blog/ftc-safeguards-rule-for-tax-preparers)
- [Verito: IRS Pub 4557 Compliance Guide](https://verito.com/irs-pub-4557)

**Congressional enforcement context:**
- [Schiff Letter: Investigation into Tax Preparer Disclosure to Facebook](https://schiff.house.gov/news/press-releases/schiff-urges-investigation-into-disclosure-of-taxpayers-personal-financial-information-to-facebook)
- [Tax Notes: Lawmakers Ask TIGTA to Probe Disclosure](https://www.taxnotes.com/research/federal/legislative-documents/congressional-tax-correspondence/lawmakers-ask-tigta-to-probe-taxpayer-disclosure-to-facebook/7fxk8)

---

*End of memo. Disclaimer: This is research output, not legal advice. The exact application of §7216 to Docket's specific configuration should be reviewed by qualified tax counsel and Docket's WISP-designated Qualified Individual before deployment.*
