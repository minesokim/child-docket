# IRS Systems Automation Surface — 2026-05-14

**Audience:** Docket architecture team. Decision-driver for the Year-Round Representation pillar (CLAUDE.md §10, 40%+ of EA revenue).

**Bottom line up front:** The IRS has no general-purpose practitioner API in 2026. The only first-party API surfaces are e-Services TDS/TIN-Match/SOR (transcript-shaped, requires Client ID + EFIN + suitability), MeF (returns), IRIS (information returns), and IVES (lender-shaped). Everything else — POA filing, OIC, payment plans, notice response, refund status — is web-only with ID.me MFA. The path to representation-grade automation runs through (a) a transcript aggregator partner (TaxStatus / TaxNow / Canopy / Compliancely) for the daily monitoring loop, (b) Docket's own e-Services Client ID for TDS once EFIN is in place, and (c) Tax Pro Account for real-time POA/TIA filings on individual matters. Browser automation against the IRS is high-risk and not viable as a primary surface.

---

## 1. IRS Tax Pro Account

**Current scope (post Feb 2026 expansion / IR-2026-22):**
- Submit Form 2848 (POA) and Form 8821 (TIA) for **individual** taxpayers with **real-time processing** (this is the only IRS channel that processes authorizations in minutes vs. the 4–6 week CAF unit queue).
- View active authorizations; withdraw authorizations.
- View taxpayer balance due, payment activity, audit status (within the scope of the active authorization).
- Make payments and create payment plans on behalf of individual taxpayers.
- **New in Feb 2026 (business CAF features):** A designated firm representative can link the business CAF to the firm's EIN, manage which employees can act under the business CAF, view taxpayer info within the firm's authorizations, and withdraw active authorizations on behalf of the firm.
- Tax matters covered: Form 1040 income tax, Split Spousal Assessment / Form 8857 Innocent Spouse, Shared Responsibility Payment, Civil Penalty (with period restrictions). Tax year range: last 20 years + 3 future years.

**Hard limits:**
- **Web UI only — no public API.** All actions require an authenticated browser session.
- POA/TIA real-time processing applies only to individual taxpayers. Business-entity authorizations still go through "Submit Forms 2848 and 8821 Online" or fax/mail and queue through CAF (days to weeks).
- No transcript-pull capability inside Tax Pro Account itself; that lives in TDS / e-Services.
- "Submit one form at a time" — no batch.

**Authentication:** ID.me with MFA. Username/password is being phased out for preparers; PTIN-system access is already gated on ID.me. Login.gov is the federal government's general SSO but the IRS is on ID.me for the foreseeable future; no Login.gov option for Tax Pro Account in 2026.

**Automation viability:** Effectively zero for direct API. Browser automation through ID.me MFA is fragile and legally exposed (see §7). The only realistic path is **assistive UI** — Docket prepares the 2848/8821 inside the app, and the preparer clicks "Submit" inside their authenticated Tax Pro Account session. This is the wedge Canopy, IRS Solutions, and TaxNow all use.

## 2. IRS e-Services + Transcript Delivery System (TDS)

**Surface:**
- **e-Services** is the umbrella for three practitioner-facing APIs: TIN Matching, **Transcript Delivery System (TDS)**, and Secure Object Repository (SOR).
- **TDS via the web** lets Circular 230 practitioners with a 2848/8821 on file pull: Account Transcript, Return Transcript, Wage & Income, Record of Account, Verification of Non-Filing. Wage-and-Income is unavailable for accounts containing Form 1099-DA (digital-asset broker reporting) — fallback is Form 4506-T.
- **TDS via A2A (Application-to-Application) API** exists. To get production access, a firm must obtain an e-Services **API Client ID** by uploading a JWKs file with a valid X.509 cert and going through suitability review.

**2025 additions:** Income items reported under an EIN are coming to TDS in 2025; new 1041 and 990-T return transcripts released Jan 2025.

**Prerequisites stack:**
1. PTIN (preparer identity) — instant
2. EFIN (e-file ID) — apply at e-Services, suitability check includes credit + tax compliance + criminal background; **45 days typical, longer Oct–Jan**. Fingerprinting required if not CPA/EA/attorney.
3. CAF number (issued first time you file an authorization)
4. e-Services account with ID.me MFA
5. API Client ID (separate app, X.509 cert)

**Authentication:** ID.me MFA for the web UI. For A2A, OAuth-style cert-based machine auth; user assertions piggyback on a human's e-Services session.

**Batch & limits:** TDS A2A supports batch transcript requests but is **gated to authorized partners** with a real EFIN and a Reporting Agent or 2848/8821 on file per taxpayer. There is no documented per-second rate limit publicly; the e-Help Desk (866-255-0654) gates onboarding.

**Automation viability:** **High** — this is the one place where Docket can plug in real automation. Once a 2848/8821 is on file with the CAF unit (or via Tax Pro Account real-time), TDS A2A pulls are scriptable and bulk-safe. Wedge cost: ~3–6 months to get EFIN + Client ID + ATS testing + production approval.

## 3. IRS Solutions (irssolutions.com)

**Product:** Tax-resolution platform used by Antonio (per Docket context) and a meaningful slice of EAs/CPAs in tax-controversy practice.

**Capabilities (all bundled into one subscription):**
- Automatic weekly transcript downloads (Account + Wage & Income)
- **IRS Advance Notice™ (IAN)** monitoring — pre-detects audits, federal tax liens, installment-agreement changes, OIC activity, passport certifications, **typically ~6 months ahead of the formal IRS letter to the client**
- 2848/8821 prep + submission workflow with CAF-status monitoring
- Bankruptcy discharge date calculation
- CSED calculator
- First-time penalty abatement automation
- Custom-branded client portal
- E-signature integration (5 free per month, then $1–$2 per request)
- Embedded payment processing (CPACharge)

**Pricing (verified May 2026):**
- Solo: $189/mo or $1,890/yr
- Multi-user: $378/mo for 3 users, scaling at "every 2 users, 3rd free"
- Enterprise (22+): custom

**API:** IRS Solutions advertises a "powerful API" supporting transcript requests, CAF checks, audit alerts, and IRS Advance Notice in bulk — but it is **not a published public API**. There is no developer documentation portal, no rate card, no OpenAPI spec. It is a private integration channel reached by sales conversation. Cap­terra and G2 reviews describe it as "by request" enterprise integration.

**ToS reality:** Their API exists for firms that buy a multi-seat license and want to backflow data into their own CRM. **Bulk-pull for downstream re-sale or rehosting is not contemplated by the standard agreement** and would have to be specifically negotiated. There is no signal they're open to white-label / reseller arrangements with a competing platform.

**Partner program:** Not formally published. Their "partner rewards" link is an affiliate-style referral program, not a technical partnership.

**Strategic read:** IRS Solutions is a **competitor** to Docket more than a supplier. They would not be a long-term integration partner; we'd be paying them to enable their own moat. Useful as a benchmark of features that EAs expect.

## 4. Third-party transcript aggregators

The "permanent deprecation" of many legacy practitioner transcript-pulling tools (2021–2023) created a small partner ecosystem of IRS-API integrators. Three relevant players:

### TaxStatus (verifiedfinancials)
- **Developer-friendly REST API** at developer.taxstatus.com — this is the only aggregator with public API docs.
- Consent flow: TaxStatus collects Form 8821 from the taxpayer; flow can be embedded in your app or hosted on TaxStatus.
- Data products: official income, levy, liens, filings, account-change monitoring, transcripts in PDF.
- Latency: usually same-day, sometimes 1–2 days from consent to first transcript.
- **Pricing:** Pricing page is published (taxstatus.com/pricing) but specific dollar amounts are gated to a sales call — historical reports show per-client subscription pricing for ongoing monitoring with one-time pull options.
- **Integration:** Used by financial advisors and tax planners more than tax-controversy shops. Best documented API of the bunch.

### TaxNow
- Direct IRS data feed, nightly transcript refresh, alerts on changes.
- 8821-based onboarding with their CAF on the form.
- **Native Karbon integration** (the leading accounting-firm practice management tool) — nightly pushes new transcripts and IRS-account-change events into Karbon's contact timeline with source-transcript attached and routing rules to owners/managers.
- Targeted at **CPAs and proactive-tax-planning firms** more than rep-only shops.
- API exists but is less publicly documented than TaxStatus.

### Compliancely
- Originally a lender-facing tax-transcript API (Form 4506-C / IVES-lookalike) that has expanded into preparer-facing 8821 flows.
- Public developer portal: apideveloper.compliancely.com.
- Five transcript types covered (Return / Account / W&I / Record of Account / Non-Filing) with the IRS-standard year limits (4 / 10 / 9 / 3+ / current).
- Three-step model: collect consent → e-sign → pull via API. Embedded widgets available.
- SOC 2, 99.99% uptime claim.
- Pricing not published; enterprise sales.

### Canopy
- First mover on the IRS-API transcript integration (collaboration announced 2021).
- Now bundled inside the Canopy practice-management product — **not sold as a standalone API**.
- Pulls instant transcripts with parsing and actionable recommendations.
- Canopy is a **direct competitor** to Docket (full practice-management suite), so partnering with them would be self-defeating; useful only as a benchmark.

### 8821 dual-consent conflict (CLAUDE.md §15 D6)
The structural issue: every active 8821 on a taxpayer points to a specific CAF number. When a new 8821 is filed with a different CAF, the IRS does NOT automatically retire the old one — both representatives remain authorized until one withdraws or the form expires. **Practical effect for Docket:** if a client already has TaxStatus/Canopy/IRS-Solutions monitoring under their CPA's CAF, and Docket files an 8821 under Docket's (or the EA's) CAF, both parties continue to receive transcript-change alerts and the client may get duplicated outreach. There is no IRS API to query "who else has an active 8821 on this taxpayer." This is the **descope justification** for D6 — Docket can't cleanly own the monitoring loop in V1 without explicit client conversation and prior-rep withdrawal.

## 5. ID.me + Login.gov authentication reality

- **ID.me is the IRS identity provider** for: Online Account, Tax Pro Account, e-Services, PTIN system, Where's My Refund (when logged in), Online Payment Agreement.
- IRS legacy username/password is being deprecated; preparers with SSN-based accounts can no longer access the PTIN system without ID.me.
- ID.me requires MFA on every sign-in. The Verified Credential (selfie + government ID) is required at enrollment; some workflows require video selfie review.
- **Login.gov** is used by SSA, USPS, DHS, and ~40 other federal agencies, but **not by IRS for tax-pro tools** in 2026. There is no signal IRS is moving away from ID.me.

**Automation viability:**
- **Headless automation through ID.me is not viable.** ID.me uses device fingerprinting, behavioral signals, video-selfie liveness checks, and MFA push to a registered device.
- There is no preparer-credentialed bypass for automation. The closest analog is the e-Services **API Client ID + X.509 cert** path, which authenticates a registered application (not a browser session) but only for the e-Services APIs (TDS / TIN-Match / SOR). It does NOT cover Tax Pro Account, OPA, Document Upload Tool, etc.
- **The practical pattern** every credible vendor uses: the human preparer signs in to ID.me on their device, and the vendor's tool either (a) is invoked inside that authenticated session as a browser extension / desktop helper, or (b) operates entirely through the e-Services API Client ID with the preparer's CAF and EFIN. **Bot-driven ID.me login at scale is a deal-breaker risk.**

## 6. IRS Direct File partner program

**Status (Nov 2025):** **Cancelled for filing season 2026.** IRS product manager Cindy Noe formally notified state revenue departments that Direct File "will not be available in Filing Season 2026. No launch date has been set for the future." Most Direct File staff have left government or been RIF'd.

**What replaces it:** Section 70607 of the One Big Beautiful Bill Act directs Treasury to spend $15M on a 90-day study of **public-private partnership** replacement models that could cover up to 70% of taxpayers. As of May 2026 the study has not produced a published architecture or partner-program spec. IRS Free File (the AGI ≤ $89K trusted-partner program) remains in place with 8 partners for FS2026.

**Implication for Docket:** Direct File API integration is **off the table** — there is no API to integrate against, the program is shut down, and the public-private replacement is at least 12–24 months from a partner-onboarding window. The CLAUDE.md §15 D6 descope (defer Direct File partnership to V1.5) is now stronger than originally framed — this isn't a "V1.5 timing" issue, it's a "wait for the program to come back" issue. **Reclassify from V1.5 to V2+ contingent on PPP study outcome.**

## 7. Browser automation viability + legal posture

### Anti-bot detection on IRS systems
- ID.me alone applies bot-detection (device fingerprinting, behavioral analytics, liveness on selfie verification, geo-IP consistency, MFA push challenges).
- IRS systems behind ID.me (Tax Pro Account, e-Services web UI, OPA, Document Upload Tool) inherit ID.me's detection plus their own session-timeout behavior (typically 15–30 minutes idle).
- Captchas appear inconsistently — primarily on Where's My Refund and the OIC pre-qualifier; less on authenticated pages.
- Rate limiting is undocumented but **transcript pulls via the TDS web UI are observed to throttle aggressively** after ~20–50 actions in a short window; aggregators that scaled in the past (TRX, Roger, others) were either co-opted into the API program or shut down.

### Risk of IRS revoking automation
- The IRS has a history of cutting off third-party transcript-pulling tools (the 2021–2023 wave). The official phrasing was "permanent deprecation of legacy practitioner transcript-pulling tools." The IRS's preferred path is now the **API Client ID partner program**. Aggressive browser automation is the highest-risk surface — high probability of IP block, partner termination, or e-Services account suspension.

### Legal posture — Pub 1345, Pub 4557, Circular 230, §7216, §6694

- **Pub 1345 (e-file providers / Form 8879 e-sign):** Remote e-signature on Form 8879 requires Knowledge-Based Authentication (KBA) via a third party (LexisNexis-style multi-choice questions). Software must retain a digital image of the signed form, date/time, IP, username, KBA results, and an audit trail. **No prohibition on automation per se** — Docket's job is to provide the audit trail. Wet signature still required for mailed/faxed forms.
- **Pub 4557 (safeguarding taxpayer data):** Imposes a WISP (Written Information Security Plan), data-encryption-at-rest, access-control, breach-notification obligations on preparers and their vendors. Docket as a service provider is in scope. No specific AI prohibition.
- **Circular 230 (in particular §10.8 and the proposed 2025 amendments):** Treasury issued proposed regs in Jan 2025 retitling §10.8 to "Participation in IRS proceedings by non-practitioners" and removing the prohibition on non-practitioners preparing "all or substantially all" of a return. Public comment ended Feb 24, 2025; final regs pending. **For Docket specifically:** §10.22 due-diligence and §10.34 unreasonable-position rules apply to the EA-of-record whether the work was AI-drafted or not. The EA must "engage, supervise, train, and evaluate" the AI per the OPR's 2024 written advice on AI use.
- **§7216 (criminal disclosure):** Criminal misdemeanor (up to $1,000 / 1 year) plus civil $250/disclosure for using or disclosing return info without taxpayer consent. **AI-specific risk:** sending tax-return data to an external LLM API constitutes disclosure unless it falls in a §301.7216-2 carve-out (auxiliary service / quality control). Docket's architecture needs (a) §7216 consent built into intake, or (b) the LLM call to happen inside an auxiliary-service contractor that is bound by §7216 confidentiality. The AICPA SSTS and OPR have both flagged ChatGPT-style cleartext prompts as a §7216 violation risk.
- **§6694 (preparer penalty):** Penalty is **greater of $1,000 or 50% of preparer income from the return** for an unreasonable position; **greater of $5,000 or 75%** for willful or reckless conduct. AI-generated returns are not separately addressed — the penalty attaches to the signing preparer. **The architectural implication:** Docket must surface every position with a clear authority-level disclosure to the signing EA, log the EA's acceptance, and make Form 8275 disclosure friction-free for any position below the "substantial authority" bar.
- **IRS OPR 2025-4 ("In-house tax professionals and Circular 230"):** Recent OPR guidance reinforces that practitioners delegating to subordinates (including AI) carry the same supervisory obligations and must validate output.

## 8. Per-workflow current state

| Workflow | Today's path | API/Automation path | Docket V1 approach |
|---|---|---|---|
| **Pull IRS transcripts** (Account / Return / W&I / Record of Account) | TDS web UI (preparer with 2848/8821 + EFIN + CAF) OR aggregator | **TDS A2A API (Client ID)** is the legitimate scale path; aggregators wrap it | **V1:** TaxStatus/TaxNow/Compliancely aggregator partnership (3–6 weeks to live). **V1.5:** Direct TDS A2A Client ID once EFIN + ATS testing complete. |
| **File Form 2848 (POA)** for individual taxpayer | Tax Pro Account real-time (minutes) OR "Submit Forms 2848 and 8821 Online" (weeks) OR fax | No public API. Tax Pro Account web UI only. | **V1:** Docket pre-fills 2848 inside the app; preparer submits via Tax Pro Account (one-click handoff). Track CAF-approval status via aggregator monitoring. |
| **File Form 8821 (TIA)** | Same as 2848 | Same as 2848. Aggregators offer hosted 8821 e-sign flows that name THEIR CAF, not the preparer's. | **V1:** If using an aggregator for monitoring, use the aggregator's 8821 flow (their CAF). For Docket-direct rep work, hand off to Tax Pro Account. |
| **Respond to CP2000 notice** | IRS Document Upload Tool (preparer or taxpayer logs in, uploads response packet) OR fax/mail | No API. DUT is a web upload behind ID.me. | **V1:** Docket drafts response packet + Form 1040-X if needed; preparer logs in and uploads. Track via aggregator transcript monitoring (CP2000 appears as TC 922 / TC 290 / TC 977 pattern). |
| **File Form 8275 (Disclosure)** | Attached to the original return at e-file time | No standalone API — flows through MeF as a return attachment | **V1:** Generated inside Docket return-prep flow; included in MeF submission via Docket's MeF integration (or via the preparer's existing tax-prep software in V1 if Docket isn't yet a transmitter). |
| **Offer in Compromise (OIC)** | Form 656 + 433-A(OIC) — **submittable through Individual Online Account in 2026** for most individual filers; businesses still mail. $205 fee. | No API. IOLA upload only. | **V1:** Docket drafts the 656 package + 433-A(OIC); taxpayer (or preparer with POA) uploads via IOLA. Status tracking via transcript monitoring. |
| **Installment agreement / OPA** | Online Payment Agreement web app (taxpayers ≤$50K combined; short-term ≤$100K) OR Form 9465 | No public API for OPA. POA holder can act through Tax Pro Account for individual payment plans. | **V1:** Docket calculates the optimal plan + payment, hands off to OPA / Tax Pro Account. |
| **IAN-style alerts (audit / lien / passport)** | IRS Solutions' proprietary IAN feature OR equivalent via TaxStatus/TaxNow nightly transcript-diff | Aggregators reduce this to webhook events | **V1:** Aggregator partnership (TaxNow + Karbon integration is the model). Surface as Docket-native alerts in the preparer's dashboard. |
| **Refund status** | Where's My Refund (web/IRS2Go) — requires SSN/ITIN + filing status + exact refund amount | **No public API.** Aggregators don't generally cover refund status. | **V1:** Skip. Tell the client to use WMR or IRS2Go. **V1.5:** Scrape on a per-client opt-in basis if absolutely needed (low value, high anti-bot risk). |

## 9. Recommended Docket implementation

### V1 (ships at Docket launch)
1. **Transcript monitoring via aggregator partnership.** Pick **one** of: TaxStatus (best API docs, financial-advisor lean), TaxNow (strongest accounting-firm play with the Karbon precedent), or Compliancely (best lender-shaped pricing if cost is sensitive). **Recommendation: TaxStatus first** — public REST API, public docs, fastest to integrate; backfill TaxNow if Karbon-using firms become a Docket ICP segment.
2. **2848 / 8821 assistive UI.** Docket pre-fills, validates, and packages the form. Preparer reviews and submits via Tax Pro Account in one click (deep-link into the form-upload flow). Docket polls the aggregator's CAF-status feed for "authorization active" before unlocking transcript pulls.
3. **CP2000 response automation.** Docket drafts the response packet (1040-X if needed, supporting schedules, cover letter, citations). Preparer reviews and uploads via Document Upload Tool. Internal audit log captures every position taken so §6694 exposure is auditable.
4. **§7216 consent built into intake.** Standalone, knowing-and-voluntary consent for (a) AI processing, (b) aggregator data sharing, (c) §7216 disclosure to third parties. Stored as part of the engagement.
5. **OIC and installment-agreement draft + handoff.** Docket prepares 656 / 433-A(OIC) / 9465 packages; preparer uploads via IOLA / OPA.
6. **IAN-style alerts** as a feature on top of the aggregator transcript-diff stream.

### V1.5 (adds 6–9 months post-launch)
1. **Apply for Docket's own EFIN + e-Services API Client ID** (start the 45-day suitability + ATS testing process at the time of V1 launch; production access ~6 months out).
2. **Direct TDS A2A integration** to reduce per-transcript cost and remove the aggregator middleman for clients who want Docket-as-CAF.
3. **MeF integration for return e-filing.** Apply for transmitter status; this is the long-tail unlock for first-class return filing.

### V2+ (deferred — not committed)
1. IRS Direct File public-private partnership integration **if** the Treasury §70607 study produces a partner program.
2. Tax Pro Account API **if** IRS adds one (publicly signaled as "future expansions" but no roadmap).
3. Business-entity POA/TIA real-time processing when IRS expands the Tax Pro Account real-time pipe.

### Architectural decisions to lock now
- **Single aggregator vs multi.** Single-vendor V1 keeps complexity down. Architect the transcript-event ingest as a vendor-agnostic webhook normalizer so swapping/adding aggregators is a config change.
- **CAF strategy.** Decide whether Docket files 8821s under (a) the engaged EA's CAF (preparer-centric model) or (b) the aggregator's CAF (Docket-platform model). **(a) is correct** for an EA-OS positioning; the EA owns the relationship.
- **ID.me integration model.** Browser-extension or desktop-helper that runs inside the preparer's authenticated session is the only viable path for Tax Pro Account / DUT / OPA interactions. **Do not attempt headless ID.me automation.**
- **§7216 / WISP compliance.** Build the WISP, encrypt at rest with per-tenant keys, scope AI prompts to §301.7216-2 carve-outs (auxiliary service contract with the LLM provider). This is gating for any preparer-facing rollout.

## 10. Risk register

| # | Risk | Probability | Severity | Mitigation |
|---|---|---|---|---|
| R1 | EFIN / e-Services API Client ID approval slips past 6 months (Oct–Jan peak) | High | Med | Apply at V1 launch; budget for V1.5 = 9 months. Use aggregator-only for V1 so EFIN is non-blocking. |
| R2 | IRS shuts down chosen aggregator or revokes their API access (precedent: 2021–2023 wave) | Med | High | Build vendor-agnostic ingest layer; maintain a second-source aggregator relationship before V1.5. |
| R3 | 8821 dual-consent conflict with prior practitioner causes client confusion / churn | Med | Med | At intake, ask explicitly about prior CAF representation; auto-generate withdrawal letter for prior 8821. |
| R4 | ID.me changes its detection model and blocks browser-extension assistive UI | Low-Med | High | Keep all Docket actions to "pre-fill + click-to-submit" (no scripted clicks); avoid headless flows entirely. |
| R5 | Circular 230 final regs change AI-use rules in unfavorable ways | Med | Med | Comment-period engagement; design for the strictest plausible interpretation (signing EA always reviews; full audit log; explicit AI-use disclosure to client). |
| R6 | §7216 violation via LLM API call leaks taxpayer data | Low | Severe (criminal) | Auxiliary-service contract with LLM vendor; encrypt PII before prompt construction; redact SSN/EIN where possible; per-engagement §7216 consent. |
| R7 | §6694 penalty exposure on AI-drafted position the EA missed | Med | High (per-return) | Authority-level scoring on every position; require explicit EA acceptance click; default to Form 8275 disclosure when authority < substantial. |
| R8 | Tax Pro Account adds an API and incumbents (Canopy, Drake, Intuit) lock-in partner program before Docket | Low | Med | Build the Tax Pro Account UX as if API will arrive; instrument actions so swap is a one-day porting job. |
| R9 | Direct File PPP study produces a program that locks out small new entrants | Med | Low (V2+) | Watch Treasury study output; engage NAEA / NATP for advocacy. |
| R10 | Aggregator pricing inflates as their position consolidates | Med | Med | V1.5 direct TDS A2A integration eliminates per-transcript marginal cost above CAF capacity. |
| R11 | CAF unit processing delays mean Docket can't unlock transcript pulls for new clients fast enough | High (Oct–Jan) | Med | Use Tax Pro Account real-time pipe for individual clients; set client expectations on business POA timeline. |
| R12 | Audit by OPR or §6694 review based on AI-generated work product | Low | High | Maintain immutable per-return audit log; capture LLM model version, prompt, output, EA review timestamp. |

## 11. Citations

- [IRS announces next expansion of Tax Pro Account to support tax professional businesses (IR-2026-22)](https://www.irs.gov/newsroom/irs-announces-next-expansion-of-tax-pro-account-to-support-tax-professional-businesses)
- [Tax Pro Account](https://www.irs.gov/tax-professionals/tax-pro-account)
- [Submit Forms 2848 and 8821 online](https://www.irs.gov/tax-professionals/submit-forms-2848-and-8821-online)
- [Submit power of attorney and tax information authorizations](https://www.irs.gov/submit-power-of-attorney-and-tax-information-authorizations)
- [Transcript Delivery System (TDS)](https://www.irs.gov/tax-professionals/transcript-delivery-system-tds)
- [E-Services](https://www.irs.gov/e-services)
- [Get an API client ID](https://www.irs.gov/tax-professionals/get-an-api-client-id)
- [IRS e-Services API Authorization User Guide](https://content.govdelivery.com/attachments/USIRS/2022/11/21/file_attachments/2335011/IRS%20eServices%20API%20Authorization%20User%20Guide.pdf)
- [Become an authorized e-file provider](https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider)
- [Modernized e-File (MeF) program information](https://www.irs.gov/e-file-providers/modernized-e-file-program-information)
- [Modernized e-File (MeF) overview](https://www.irs.gov/e-file-providers/modernized-e-file-overview)
- [Reporting Agent technical fact sheet (Form 8655)](https://www.irs.gov/e-file-providers/reporting-agent-technical-fact-sheet)
- [Circular 230 practitioner e-Services access](https://www.irs.gov/e-file-providers/circular-230-practitioner-e-services-access)
- [Office of Professional Responsibility 2025-4: In-house tax professionals and Circular 230](https://www.irs.gov/pub/opr-taxpros/2025-4-in-house-tax-professionals-and-circular-230.pdf)
- [Major Changes to Circular 230: Implications for Tax Professionals (CPA Trendlines, Jan 2025)](https://cpatrendlines.com/2025/01/17/major-changes-to-circular-230-implications-for-tax-professionals-cornerstone-report/)
- [Treasury Issues Proposed Regulations Amending Circular 230 (CPA Journal, Jul 2025)](https://www.cpajournal.com/2025/07/22/treasury-issues-proposed-regulations-amending-circular-230/)
- [Section 7216 information center](https://www.irs.gov/tax-professionals/section-7216-information-center)
- [Tax preparer penalties (§6694)](https://www.irs.gov/payments/tax-preparer-penalties)
- [IRS Publication 1345 (Authorized IRS e-file Providers)](https://www.irs.gov/pub/irs-access/p1345_accessible.pdf)
- [Frequently Asked Questions for IRS e-file Signature Authorization](https://www.irs.gov/e-file-providers/frequently-asked-questions-for-irs-efile-signature-authorization)
- [IRS Document Upload Tool](https://www.irs.gov/help/irs-document-upload-tool)
- [Understanding your CP2000 series notice](https://www.irs.gov/individuals/understanding-your-cp2000-series-notice)
- [Offer in Compromise](https://www.irs.gov/payments/offer-in-compromise)
- [Online payment agreement application](https://www.irs.gov/payments/online-payment-agreement-application)
- [IRS Direct File 'will not be available' in 2026 (Federal News Network, Nov 2025)](https://federalnewsnetwork.com/it-modernization/2025/11/irs-direct-file-will-not-be-available-in-2026-agency-tells-states/)
- [IRS Shutters Direct File, Citing Cost and Low Uptake (Tax Notes)](https://www.taxnotes.com/featured-news/irs-shutters-direct-file-citing-cost-and-low-uptake/2025/11/05/7t7q0)
- [Direct File is gone; what's next for free filing and tax pros? (NATP)](https://www.natptax.com/news-insights/blog/direct-file-is-gone-what-s-next-for-free-filing-and-tax-pros/)
- [Sign in to the IRS with ID.me to access online services](https://help.id.me/hc/en-us/articles/4402761374231-Sign-in-to-the-IRS-with-ID-me-to-access-online-services)
- [IRS and ID.me](https://help.id.me/hc/en-us/articles/8214940302999-IRS-and-ID-me)
- [Creating an account for IRS.gov](https://www.irs.gov/help/creating-an-account-for-irsgov)
- [IRS Solutions Pricing](https://www.irssolutions.com/pricing/)
- [IRS Solutions Features](https://www.irssolutions.com/features/)
- [IRS Advance Notice™ (IAN) / Auditing Software](https://www.irssolutions.com/features/auditing-software-for-accountants/)
- [IRS Transcript Monitoring Software for Tax Pros (IAN)](https://www.irssolutions.com/features/irs-transcript-monitoring-software/)
- [Verified Financials by TaxStatus](https://www.taxstatus.com/)
- [TaxStatus Developer Documentation](https://developer.taxstatus.com/)
- [TaxStatus Pricing](https://www.taxstatus.com/pricing/)
- [TaxNow](https://www.taxnow.com/)
- [TaxNow + Karbon Integration](https://karbonhq.com/integrations/taxnow/)
- [Compliancely IRS Tax Transcripts](https://compliancely.com/irs-tax-transcripts)
- [Best IRS Tax Transcript API & Parsing Tools for Lenders (Compliancely blog)](https://compliancely.com/blog/irs-tax-transcript-api-parsing-tools/)
- [Compliancely API Documentation](https://apideveloper.compliancely.com/docs/how-transcript-works)
- [Form 8821 vs. Form 2848 (Compliancely)](https://compliancely.com/blog/form-8821-vs-form-2848/)
- [Canopy Collaborates with IRS on First API Integration (BusinessWire, 2021)](https://www.businesswire.com/news/home/20210524005150/en/Canopy-Collaborates-with-IRS-on-First-API-Integration-for-Secure-Transcript-Retrieval)
- [Canopy Transcripts & Notices](https://www.getcanopy.com/transcripts-notices)
- [Using Form 8821 to Deliver Higher-Value Service Through Proactive Transcript Monitoring (CPA Journal, May 2026)](https://www.cpajournal.com/2026/05/04/using-form-8821-to-deliver-higher-value-service-through-proactive-transcript-monitoring/)
- [IRS Rolls Out New Enhancements to the Tax Pro Account (CPA Practice Advisor, Feb 2026)](https://www.cpapracticeadvisor.com/2026/02/09/irs-rolls-out-new-enhancements-to-tax-pro-account/177739/)
- [IRS expands Tax Pro Accounts (Accounting Today)](https://www.accountingtoday.com/news/irs-expands-tax-pro-accounts)
- [IRS broadens Tax Pro Account for accounting firms and others (Journal of Accountancy)](https://www.journalofaccountancy.com/news/2026/feb/irs-broadens-tax-pro-account-for-accounting-firms-and-others/)
- [IRS expands tax pro accounts to support business users (NATP)](https://www.natptax.com/news-insights/blog/irs-expands-tax-pro-accounts-to-support-business-users/)
- [Assessing AI From a Tax Perspective, Part 2 (TXCPA, 2025)](https://www.tx.cpa/news-publications/todays-cpa-magazine/issues/article/march-april-2025/2025/06/09/assessing-ai-from-a-tax-perspective--part-2)

---

**Word count:** ~3,400. Saved to `docs/architecture-research/IRS-SYSTEMS-AUTOMATION-2026-05-14.md`.
