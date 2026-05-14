# California State Agency Automation Surface — 2026-05-14

**Scope:** Research deliverable for Docket V1 CA state corpus. Maps the automation surfaces of FTB, CDTFA, EDD, and CA SoS to inform Docket's hybrid architecture (Composio for federal/SaaS, browser automation in Fly.io sandboxes for state agencies).

**Headline.** California has no unified preparer-side REST API across agencies. Each agency exposes some combination of: (a) MeF/XML transmitter pipelines (return filing, gated by Letter of Intent); (b) authenticated web portals with MFA (preparer operations); (c) public data APIs (read-only reference data). Production automation requires a hybrid: MeF for return filing where Docket qualifies as a transmitter, Playwright in Fly.io sandboxes for preparer-side reads and most non-return writes, and public APIs for entity standing and tax-rate lookups.

---

## 1. Franchise Tax Board (FTB)

**Authentication.** MyFTB = username + password + mandatory SMS/voice MFA (since 2024-07-13). Phone number is required at registration. Account types: individual, business representative, tax professional, withholding agent. Authorization flow:
- **TIA (Tax Information Authorization)** — view-only, electronic via MyFTB.
- **POA** — full representation; FTB 3520-PIT / 3520-BE; full MyFTB online access requires client to receive an FTB-mailed auth code and approve.

**Preparer API.** None. FTB states "FTB does not provide a tax transcript service." Practitioners are directed to MyFTB web UI. The Tax Practitioner Hotline (916-845-7057) is the official escalation channel, not programmable.

**MeF / return-filing pipeline.** FTB participates in IRS Modernized e-File piggyback. Developers and transmitters access California schemas via the **FTA State Exchange System (SES)** after submitting a **Letter of Intent (LOI) per supported tax year**. Key documents:
- **FTB Pub 1345** — Handbook for Authorized e-file Providers (annual; current 2025).
- **FTB Pub 1346X / 1346B** — Software Developer Guides (Individual+Fiduciary / Business).
- **FTB Pub 1436X** — Test Package / ATS for California e-file.

Returns transmit over **SWIFT (Secure Web Internet File Transfer)**, with per-submission ACK. Forms supported via MeF: 540, 540 2EZ, 540NR, 540ES, 100/100S/100W, 565/568, 541, 199. Signature: FTB 8453 family (8453, 8453-OL, 8453-FID, 8453-C, 8453-BE, 8453-EO, 8453-PMT).

**Open Data Portal.** `data.ftb.ca.gov` — Socrata SODA. Non-confidential statistical datasets only (PIT back to 1955, corp back to 1950). Free, no auth; rate-limited at the Socrata layer.

**API Terms and Conditions.** Explicitly prohibit "scraping, building databases, or creating copies of data accessed using FTB APIs except as necessary to enable FTB's intended usage scenario." FTB reserves the right to rate-limit, suspend, or terminate. These ToS attach to the published API endpoints, not all of `ftb.ca.gov`, but they signal FTB's general stance.

**Notices Docket must classify (form-number prefix + suffix):**
- **FTB 4963** — State Income Tax Balance (annual).
- **FTB 4734D** — Request for Tax Information and Documents.
- **FTB 5818-B** — Notice of Tax Return Change, Revised Balance.
- **FTB 4905 PIT / 4905BE** — Offer in Compromise (PIT / Business Entity).
- **FTB 4502** — Demand for Tax Return (entity).
- **FTB 3557 (LLC/A/BC)** — Application for Certificate of Revivor.
- **Identity Verification Notices** (CSEA-documented).
- Digital delivery is opt-in via MyFTB; notice text appears in the Correspondence inbox.

The "DEMAND-110" / "DEMAND-280" labels in the brief don't map to published FTB documentation under those exact names — they're likely internal Docket taxonomy slugs that need backing form numbers from the list above.

**Suspension/forfeiture detection.** FTB suspension (missed $800 franchise tax, missing returns, etc.) is mirrored to CA SoS records as **"FTB Suspended"** / **"FTB Forfeited."** At 60 months, FTB issues a Pending Administrative Termination notice (60-day cure window). Docket can monitor via the SoS bizfile online portal (see §4) without burning MyFTB sessions.

**Scraping tolerance.** Public ftb.ca.gov pages have no published rate limit and no aggressive bot detection. MyFTB sits behind login+MFA and is governed by the MyFTB user agreement, not the API ToS — scraping with the user's own credentials and client consent is a gray zone but not flatly prohibited.

**Recommended automation.**
- **Return filing:** Pursue MeF transmitter LOI for supported tax years. Until processed, ride a partner transmitter or stay advisory.
- **Account inspection (balances, payments, year summaries, notices):** Playwright against MyFTB with preparer credentials + client POA/TIA. Cache auth state per preparer; emit ComplianceCheck per scrape with POA/TIA artifact ID.
- **POA/TIA filing:** Browser automation against MyFTB "Submit Tax Information Authorization."
- **Statistical data:** Socrata SODA on data.ftb.ca.gov.

---

## 2. California Department of Tax and Fee Administration (CDTFA)

**Authentication.** `onlineservices.cdtfa.ca.gov` — username + password + security questions; MFA rolling out as mandatory. Tax reps must be added as **Third Parties** to the client's account, with the **client initiating** the grant.

**API surface.**
- **CDTFA Tax Rate API** (REST + SOAP, `services.maps.cdtfa.ca.gov` + CA State Geoportal). Free, no auth. Endpoints: `GetRateByLngLat`, `GetRateByAddress`, `GetRateByZipCode`. Returns state + local + district rates.
- **Permit Verification Service** (`services.cdtfa.ca.gov/webservices/verification.jsp`) — public, no auth. Validates seller's permits, cigarette/tobacco retailer licenses, eWaste accounts. Also via phone (1-888-225-5263).
- **CDTFA Data Portal** (`cdtfa.ca.gov/dataportal/api/`) — aggregate sales/use tax statistics. Public, no auth.
- **No preparer-side filing API.** Returns filed through portal or approved third-party online filers.

**Portal filings.** Sales and Use Tax Return (CDTFA-401), prepayments, CDTFA-1150 (use fuel), excise/special tax returns. Filing schedule: monthly (>$17K avg tax due), quarterly, or annual (<$1.2K). Most businesses are required to file electronically.

**Account history.** No native "transcript." Returns, payments, balances browsable in the portal once authenticated.

**Public records.** Seller's permit data (permit number, holder name, business location, status, close-out date) is releasable under the CA Public Records Act; local jurisdictions also receive bulk extracts monthly under a Data Extraction Program. Confirms permit data is broadly public.

**ToS.** CDTFA's OPEN CDTFA Terms of Use gate the open-data API. No sweeping anti-scraping clause on the main portal, but authenticated online-services access carries confidentiality obligations.

**Recommended automation.**
- **Permit verification:** Direct HTTPS call to the verification service for every resale-certificate counterparty.
- **Tax rate lookups:** REST API at quote/invoice time.
- **Sales/use tax filings:** Playwright + Third Party access. Portal supports bulk CSV/XML upload — Docket generates the file and drives the upload.
- **Account monitoring:** Scheduled Playwright for balance, periods, notices.

---

## 3. Employment Development Department (EDD)

**Authentication.** `eddservices.edd.ca.gov` / e-Services for Business. Username + password. **Third parties can't self-enroll** — EDD verifies reps first. Tax reps / payroll agents / CPAs enroll via a separate Representative workflow.

**API surface.** No preparer API. e-Services for Business supports **bulk file upload** — the de facto integration path:
- **DE 9 / DE 9C** — Quarterly Contribution Return and Report of Wages (+ Continuation). XML or ZIP.
- **DE 88** — Payroll Tax Deposit. **CSV or XML.** Multi-employer bulk payments supported (DE 154 EFT Bulk Payment Guide).
- **DE 3BHW** — Household Worker Quarterly Report.
- **DE 3D / DE 3DI** — variant Quarterly Contribution Returns.
- **DE 48** — Power of Attorney Declaration.
- Wage report formats: **ICESA, MMREF, XML** (SSA-style).

**DE 8300** is the canonical developer reference for these file formats.

**Worker classification.** DE 1810 (unemployment determination), DE 1870 (worker classification) live outside e-Services and are mail/portal-mixed — Docket can prepare, not end-to-end automate.

**Independent contractor reporting.** **DE 542** — Internet Independent Contractor Reporting (iICR), web-only.

**Public records.** Employer account data is NOT publicly searchable. CA Public Records Act requests to EDD Legal Office (first 100 pages free, then $0.10/page). Not a viable automation path.

**Recommended automation.**
- **DE 9 / 9C / 88 quarterly filings:** Generate spec-compliant XML/CSV per DE 8300, drive Playwright through e-Services Bulk Upload.
- **Account standing:** Playwright pulls of quarterly status, balance, notice inbox.
- **DE 542:** Browser automation against iICR (only path).
- **DE 1810 / 1870:** Document prep + human review.

---

## 4. California Secretary of State (CA SoS)

**Authentication for filing.** `bizfileonline.sos.ca.gov` requires an account for filings (SOI, formation, dissolution). Preparer-agnostic — no registered tax-pro relationship concept at SoS.

**API surface — strongest of the four agencies.**
- **Developer Portal:** `calicodev.sos.ca.gov` (Azure API Management).
- **BE Public Search API v1.0.4** — JSON, subscription-key gated, free tier. Returns up to 150 matches: entity name, entity number, formation date, type, status (Active / Suspended / Dissolved / Forfeited / FTB Suspended / FTB Forfeited), registered agent, principal address, filing history.
- Auth: subscription key in HTTP header.
- **No filing API.** All SOI, formation, dissolution, conversion, and foreign-entity filings are bizfile online-only. As of 2025, paper SOI filings are not accepted for LLCs.

**Bizfile filings (online-only, instant approval):**
- **Statement of Information** — LLC-12 (every 2 years, $20); SI-100 (nonprofit), SI-550 / SI-550A (stock corp, annual, $25). First SOI due 90 days after formation.
- **Formation** — Articles of Organization (LLC) / Incorporation (Corp).
- **Foreign entity** — LLC-5, S&DC-S/N.
- **Termination** — LLC-3 / LLC-4-7, Certificate of Election to Wind Up.

**Status semantics Docket monitors:**
- **Active** — good standing.
- **Suspended (SOS)** — missed SOI; revived by filing + $250 penalty.
- **FTB Suspended** — tax issue; revived by FTB clearance + FTB 3557 LLC/Corp.
- **FTB Forfeited** — foreign entity variant.
- **Dissolved / Cancelled / Surrendered** — terminated.
- **FTB Pending Administrative Termination** — 60-month mark; 60-day cure window.

**ToS / scraping.** SoS publishes the BE Public Search API as the supported programmatic path. Scraping bizfile is redundant when the API exists. CA SoS holds 17M+ records; Azure APIM rate-limits the API.

**Recommended automation.**
- **Entity standing monitoring:** Daily BE Public Search API poll per client. Watch status transitions — this is the single most valuable cross-agency signal (FTB problems mirror here within ~30 days).
- **SOI filing:** Playwright against bizfile — highest-frequency SoS filing for Docket clients.
- **Formation / foreign / dissolution:** Playwright + human-in-the-loop given legal weight.

---

## 5. Cross-agency entity linking

Each agency uses its own primary key. Docket's **canonical client object** must store all of these and link them deterministically:

| Agency | Primary key | Format | Source |
| --- | --- | --- | --- |
| CA SoS | Entity Number | 12 chars (corp = 7-digit "C…"; LLC = 12-digit "20…"; new entities prefixed "B…") | bizfile online |
| FTB | FTB Entity ID (for businesses) / SSN-ITIN (for individuals) | Internal FTB ID; not publicly displayed for individuals | MyFTB |
| CDTFA | Account Number | Multi-segment account number tied to seller's permit | CDTFA Online Services |
| EDD | Employer Payroll Tax Account Number | 8-digit | e-Services for Business |
| Federal | EIN (entities) / SSN (individuals) | 9 digits | IRS |

**Linking algorithm.**
1. Onboarding captures EIN/SSN + entity name + formation state.
2. **CA SoS lookup** by name/number — confirms entity, captures SoS Entity Number, status, registered agent.
3. **FTB lookup** is preparer-mediated: client grants TIA/POA; Docket pulls FTB Entity ID from MyFTB after authorization.
4. **CDTFA lookup** — public permit verification (free); CDTFA Account Number from authenticated portal once client adds Docket as Third Party.
5. **EDD lookup** — captured at e-Services Representative enrollment, verified via DE 48 POA.

**Cross-agency suspension cascade.** FTB suspension mirrors to SoS within ~30 days. Polling the SoS BE Public Search API daily gives Docket a free, no-auth signal for FTB problems on every client without burning MyFTB credentials.

---

## 6. Authentication patterns + Login.gov status

**No CA-wide SSO.** Login.gov is federal-only; CA explored a Department of Technology identity gateway pilot but it's not deployed for FTB/CDTFA/EDD/SoS as of 2026-05. Each agency runs its own auth stack:

| Agency | Auth stack | MFA | Account types |
| --- | --- | --- | --- |
| FTB (MyFTB) | Custom; verified phone required | Mandatory SMS/voice since 2024-07-13; "remember me" device caching | Individual, Business, Tax Pro, Withholding Agent |
| CDTFA (Online Services) | Custom; username + password + security questions | Rolling out as mandatory | Account holder, Third Party (rep) |
| EDD (e-Services for Business) | Custom | Optional; EDD must verify third parties | Employer, Representative/Payroll Agent |
| CA SoS (bizfile + API) | Custom for bizfile; Azure APIM subscription key for API | Optional on bizfile | Generic filer; no rep concept |

**Implications.** One credential vault entry per agency per preparer. MFA on FTB means either: (a) long-lived session via "remember me" fingerprint cached in Fly.io sandbox state, or (b) interactive MFA prompt at scrape time. Recommended: session-state caching + interactive fallback on expiry. **Never** automate MFA code retrieval from a shared device — that crosses the line on most ToS interpretations.

---

## 7. Public records vs gated

| Operation | Auth required? | Notes |
| --- | --- | --- |
| CA SoS entity status / standing | Free public API (subscription key only) | BE Public Search API on `calicodev.sos.ca.gov` |
| CDTFA permit verification | Free public, no auth | Verification web service + phone IVR |
| CDTFA tax rate lookup | Free public, no auth | REST/SOAP, geocoded |
| FTB statistical / aggregate data | Free public, no auth | Socrata SODA on `data.ftb.ca.gov` |
| FTB individual/business account data | Gated: MyFTB + POA/TIA | No transcript API; web only |
| CDTFA seller's account history, filing history | Gated: Online Services + Third Party | Web only |
| EDD employer account, returns, balances | Gated: e-Services + Representative status | Web only |
| EDD bulk return / payment file upload | Gated: e-Services + Representative + DE 48 POA | XML/CSV/ICESA upload UI |
| CA SoS bizfile filing (SOI, formation, etc.) | Account-required but rep-agnostic | Web only |
| FTB return e-filing | Gated: MeF transmitter LOI + ATS | SWIFT transport |

The dividing line is sharp: public records flow freely via API; everything preparer-side requires authentication, and most things require explicit client-to-preparer authorization (TIA/POA/Third Party/DE 48). Docket's onboarding flow must orchestrate up to four separate authorization grants per client.

---

## 8. Recommended Docket implementation

**Per-agency strategy.**

| Agency | Reads | Writes |
| --- | --- | --- |
| FTB | Playwright on MyFTB (POA/TIA-gated) + Socrata for aggregate stats | MeF transmitter (LOI required) for returns; Playwright for POA/TIA filing |
| CDTFA | Direct REST (tax rate, permit verify) + Playwright for account history | Playwright on portal for CDTFA-401 + bulk uploads |
| EDD | Playwright + DE 8300-spec file generation | Playwright bulk upload of DE 9/9C XML and DE 88 CSV |
| CA SoS | BE Public Search REST API | Playwright on bizfile for SOI, formation, dissolution |

**Playwright patterns.**
- **Auth state caching:** `storageState` saved per preparer per agency at `/encrypted-volumes/playwright-state/{preparer_id}/{agency}.json`. Nightly refresh; interactive MFA prompt on expiry.
- **Selector resilience:** Anchor on `data-` attributes and accessible labels — these portals reskin every 2-3 years.
- **ComplianceCheck trailer:** Every scrape emits `{preparer_id, client_id, agency, operation, authorization_artifact_id, scope, timestamp, result_hash}` — append-only audit log.
- **Sandbox isolation:** One Fly.io sandbox per agency per preparer (not per client). Shared per-preparer sandbox reuses session state; the security boundary is cross-preparer.
- **Anti-flake:** All scrapes idempotent and retry-safe. Mutating actions (SOI filing, DE 88 payment) require an explicit human confirmation gate, logged with operator identity.

---

## 9. Risk register

| Risk | Likelihood | Severity | Mitigation |
| --- | --- | --- | --- |
| FTB API ToS extends to MyFTB scraping | Medium | High | MyFTB is governed by user agreement, not API ToS; scrape only with preparer's authenticated session + client POA/TIA; emit ComplianceCheck per scrape; never re-host or redistribute FTB data |
| CA SoS API rate-limiting on BE Public Search | Medium | Medium | Cache results; respect Azure APIM subscription tier limits; backoff on 429 |
| MyFTB MFA changes (rotation, hardware tokens) | Medium | High | Build interactive MFA fallback flow; don't depend on session caching alone |
| Anti-bot detection rolls out to MyFTB | Low | High | Use real Playwright Chromium (not headless detection-leaks); rotate User-Agent and viewport; throttle to human-paced clicks; record a baseline for behavioral fingerprint |
| IP banning of Fly.io ASN | Low | Medium | Multi-region Fly.io deployment; residential proxy fallback if needed (last resort, ToS gray zone) |
| Preparer credential reuse across firms | Medium | Critical | Hard rule: one preparer account per Docket user; never share across firms; vault per-user with HSM-backed keys |
| Client POA/TIA expired but Docket keeps scraping | Medium | Critical | Pre-flight check: ComplianceCheck looks up POA/TIA expiry before every scrape; refuse if expired |
| FTB notice classification false negative misses Demand for Return | Medium | High | OCR + LLM classification of notice text with form-number anchor; human review queue for low-confidence |
| MeF LOI rejection / suspension | Low | High | Don't make MeF the only return path; always retain a partner-transmitter fallback |
| SoS bizfile filing fails after fee paid | Low | Medium | Capture confirmation number atomically; reconcile against bizfile transaction log |

---

## 10. Multi-state expansion notes

**Auth.** No state shares auth; expect to rebuild the credential vault + session caching per state. Login.gov adoption: none of CA/NY/TX/FL — same per-agency-portal model.

**MeF.** Universal piggyback pattern. Every state with an income tax (NY yes; TX/FL no for individuals) participates. LOI per state per tax year; schema FTA-coordinated but state-specific. CA's LOI process is representative.

**API maturity comparison.**
- **CA:** Best SoS API (calicodev), free public CDTFA APIs, FTB open data. No preparer filing API.
- **NY:** NY DOS has a paid business entity API. NY DTF Online Services has Tax Professional accounts (parallel to MyFTB). No public preparer API.
- **TX:** TX Comptroller public API (`api-doc.comptroller.texas.gov`) for franchise tax search and sales tax payer location. No personal income tax. Webfile portal for sales tax.
- **FL:** No personal income tax. FL DOR e-Services for sales tax (CDTFA-equivalent). Sunbiz (FL SoS) has XML bulk data feed. No preparer API.

**Browser automation is the load-bearing path across all four states** for anything outside MeF return-filing or public-data APIs. Docket's sandbox architecture (Fly.io + Playwright + storage state + ComplianceCheck) ports directly. Per-state work: (1) map agency surface; (2) enumerate notice taxonomies; (3) build credential vault entries; (4) codify Playwright flows; (5) add public-API integrations where they exist.

Effort multipliers: CA = 1.0x (V1 baseline), NY ≈ 1.2x, TX ≈ 0.6x, FL ≈ 0.5x.

---

## 11. Citations

- [Tax professionals | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/index.html)
- [Online services | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/online-services.html)
- [MyFTB account | FTB.ca.gov](https://www.ftb.ca.gov/myftb/index.asp)
- [Tax Professional Online Account Access | FTB.ca.gov](https://www.ftb.ca.gov/myftb/tax-pro-online-account-access-descriptions.html)
- [Tax Information Authorization | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/tax-information-authorization/index.html)
- [Multi-factor authentication for MyFTB | FTB.ca.gov](https://www.ftb.ca.gov/about-ftb/newsroom/public-service-bulletins/2024-02-multi-factor-authentication-for-myftb.html)
- [MyFTB multi-factor authentication is here | FTB.ca.gov](https://www.ftb.ca.gov/about-ftb/newsroom/news-releases/2024-06-myftb-multi-factor-authentication-is-here.html)
- [California e-file program | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/index.html)
- [e-file software providers | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/efile-software-providers.html)
- [e-file for software developers | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/efile-for-developers.html)
- [Valid Individual FTB XML Schemas | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/individual-ftb-xml-schemas.html)
- [Valid Corporation and Partnership FTB XML Schemas | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/corporation-and-partnership-ftb-xml-schemas.html)
- [Valid Exempt Organization FTB XML Schemas | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/exempt-organization-ftb-xml-schemas.html)
- [Valid Fiduciary FTB XML Schemas | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/efile/fiduciary-ftb-xml-schemas.html)
- [FTB Publication 1345 (2025) — Handbook for Authorized e-file Providers](https://www.ftb.ca.gov/forms/2025/2025-1345.pdf)
- [Terms and conditions | FTB APIs | FTB.ca.gov](https://www.ftb.ca.gov/your-rights/api-terms-and-conditions.html)
- [Franchise Tax Board Open Data Portal](https://data.ftb.ca.gov/about)
- [Notices and letters | FTB.ca.gov](https://www.ftb.ca.gov/help/letters/index.html)
- [FTB Notices | FTB.ca.gov](https://www.ftb.ca.gov/tax-pros/law/ftb-notices/index.html)
- [Digital notice delivery | FTB.ca.gov](https://www.ftb.ca.gov/help/letters/digital-notice-delivery.html)
- [Request/Demand for Tax Return | Login | California Franchise Tax Board](https://webapp.ftb.ca.gov/inc/)
- [Suspended or Forfeited Business Entities | FTB.ca.gov](https://www.ftb.ca.gov/about-ftb/newsroom/tax-news/december-2021/suspended-or-forfeited-businesses.html)
- [My business is suspended | FTB.ca.gov](https://www.ftb.ca.gov/help/business/my-business-is-suspended.html)
- [FTB Pending Administrative Termination Notice | California Secretary of State](https://www.sos.ca.gov/business-programs/business-entities/ftb-admin-notice)
- [Online Services — Overview | CDTFA](https://cdtfa.ca.gov/services/)
- [CDTFA Online Services](https://onlineservices.cdtfa.ca.gov/_/)
- [Tax Guide for Tax Practitioners Filing and Payments | CDTFA](https://cdtfa.ca.gov/industry/tax-practitioners/filing-and-payments.htm)
- [Data Portal API | CDTFA](https://cdtfa.ca.gov/dataportal/api/)
- [CDTFA Tax Rate REST API — California State Geoportal](https://gis.data.ca.gov/datasets/CDTFA::california-sales-and-use-tax-rate-rest-api)
- [California Sales and Use Tax Rate SOAP API](https://gis.data.ca.gov/datasets/e549120c31b54c24b0a1e830c0f253db)
- [CDTFA Tax Rate API (Maps)](https://services.maps.cdtfa.ca.gov/)
- [Verify a Permit | CDTFA](https://services.cdtfa.ca.gov/webservices/verification.jsp)
- [Permits & Licenses | CDTFA](https://cdtfa.ca.gov/services/permits-licenses.htm)
- [Accessing the CDTFA's Records | CDTFA](https://cdtfa.ca.gov/public-records.htm)
- [Other Online Filing Service Providers | CDTFA](https://cdtfa.ca.gov/services/online-filing-service-providers.htm)
- [e-Services for Business | EDD](https://edd.ca.gov/en/Payroll_Taxes/e-Services_for_Business)
- [Employer Services Online | CA.gov](https://eddservices.edd.ca.gov/)
- [Enroll in e-Services for Business as an Employer | EDD](https://edd.ca.gov/en/payroll_Taxes/Enroll_Employer_e-Services_Business)
- [Enroll in e-Services for Business as a Representative | EDD](https://edd.ca.gov/en/payroll_Taxes/Enroll_Employer_Representative_Payroll_Agent_e-Services_Business)
- [e-Services for Business FAQs | EDD](https://edd.ca.gov/en/Payroll_Taxes/faq_-_e-services_for_business)
- [e-Services for Business — Tutorials | EDD](https://edd.ca.gov/en/payroll_taxes/e-Services_for_Business_Tutorials/)
- [Electronic Funds Transfer Bulk Payment Guide (DE 154) | EDD](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de154.pdf)
- [Electronic Filing Guide for the Quarterly Wage and Withholding Program (DE 8300) | EDD](https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de8300.pdf)
- [Public Records Request | EDD](https://edd.ca.gov/en/about_edd/public_records_request/)
- [bizfile | California Secretary of State](https://www.sos.ca.gov/business-programs/bizfile)
- [Online Business Services | bizfile online](https://bizfileonline.sos.ca.gov/)
- [Search | bizfile online](https://bizfileonline.sos.ca.gov/search)
- [File Online | California Secretary of State](https://www.sos.ca.gov/business-programs/bizfile/file-online)
- [Statements of Information Filing Tips | California Secretary of State](https://www.sos.ca.gov/business-programs/business-entities/statements)
- [Business Search FAQ / Field Status Definitions | California Secretary of State](https://www.sos.ca.gov/business-programs/business-entities/cbs-field-status-definitions)
- [CA Secretary of State API Developer Portal](https://calicodev.sos.ca.gov/)
- [APIs: List | CA SoS API Developer Portal](https://calicodev.sos.ca.gov/apis)
- [California SOS BE Public Search API Guide v1.0.4 (PDF)](https://calicodev.sos.ca.gov/content/California%20SOS%20BE%20Public%20Search%20API%20Guide%20v1.0.4.pdf)
- [Guide to the California Secretary of State API Developer Portal — Cobalt Intelligence](https://cobaltintelligence.com/blog/post/guide-to-the-california-secretary-of-state-api-developer-portal)
- [What California's FTB 4963 Notice Means — Priority Tax Relief](https://www.prioritytaxrelief.com/what-californias-ftb-4963-notice-means/)
- [Guidance on FTB Identity Verification Notices — CSEA](https://csea.org/CSEA/Resource_Library/State_Tax/Guidance_on_FTB_Identity_Verification_Notices.aspx)
- [California Corner: Calling the Practitioner Hotline — Western CPE](https://www.westerncpe.com/etax-alerts/california-corner-calling-the-practitioner-hotline/)
- [Texas Comptroller API Documentation](https://api-doc.comptroller.texas.gov/)
