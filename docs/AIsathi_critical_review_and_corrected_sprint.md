# AIsathi critical review and corrected sprint

Review date: 29 October 2026. Proposed sprint: 30 October–12 November 2026, Nepal Time.

## Decision

Proceed toward a small, capped B2B developer pilot. Treat Day 14 as a go/no-go review, with a broader commercial launch remaining conditional within the original one-to-two-month window. Neither document establishes enterprise readiness, confirmed customer demand, lawful supplier access, or profitable operations.

The useful core is local billing, controlled API access, reliable accounting, and developer support. Prioritize small agencies with an active API integration. Fintechs, institutions, and other regulated or procurement-heavy customers are later prospects.

## Scope and evidence

I read both uploaded files: **AIsathi Due Diligence Research.docx** (R) and **AISathi_B2B_Security_Audit_and_Launch_Plan.docx** (S), including their tables. References below use their section numbers and task IDs. I also checked selected public primary sources linked beside the findings.

This is a critical document and architecture review. No repository, deployment, merchant dashboard, supplier agreement, bank approval, customer interview record, or production ledger was supplied. A public payment button does not establish payment security or even successful settlement. The listed security issues are risks to verify, not demonstrated vulnerabilities. Likewise, neither “conceptual product” nor “conditional beta ready” is a verified deployment assessment.

## Contradictions and corrections

### 1. Pilot scope and customer segment

R §11 defers shared workspaces until 50 retained single-user developers request them; S §§1 and 3.1 require organizations, four roles, projects, member invitations, scoped keys, and organization switching immediately. R itself also pitches shared corporate billing before deferring the feature needed to deliver it.

**Resolution:** support one isolated billing account per pilot company, one accountable administrator, and separately revocable application keys. Preserve server-side tenant ownership checks everywhere. Defer member invitations, four-role RBAC, project hierarchy, IP allowlist UI, and elaborate analytics until a pilot requires them. Never substitute shared human login credentials for deferred membership features. If multiple human administrators are a must-have, estimate and build that explicitly or select a narrower pilot.

### 2. Timeline and dependencies

R §13 proposes a 60-day program ending 27 December; S ends in public B2B launch after 14 days. S tasks 4.1 and 2.3 build financial reservations on Days 1–4 before the ledger exists on Days 6–8. Its schedule freezes features on Day 11 while task 3.4 runs through Day 13. Payment and upstream verification wait until Days 7–10, after substantial implementation.

**Resolution:** supplier and payment dependencies start Day 1. Agree accounting invariants and contracts before reservation implementation. Build one vertical flow early. Freeze Day 10; Days 11–14 are for failures, repair, recovery, and release decisions. Keep the 60-day window for learning and broader release, not a competing deadline. If Day 1 is 30 October, Day 3 is 1 November and Day 14 is 12 November; state calendar days and confirm actual working availability.

### 3. Supplier permissions

R §§1 and 6 correctly identify a material OpenRouter resale restriction but wrongly treat enterprise procurement as an automatic cure. OpenRouter standard terms §7(4) restrict resale/competing access; its published enterprise agreement §2.3.7 also restricts resale or third-party access. A negotiated exception must expressly cover AIsathi's actual gateway, end users, geography, billing, and selected models. “Enterprise account” is not sufficient evidence. [Standard terms](https://openrouter.ai/terms), [enterprise agreement](https://openrouter.ai/terms-of-service-enterprise).

R's assertion that all direct OpenAI self-serve application use requires enterprise procurement is overbroad. OpenAI's current services agreement permits API integration into customer applications while restricting account resale and API-key transfer. That distinction does not establish permission for AIsathi's pass-through gateway. Obtain a use-case-specific determination. [OpenAI agreement §§2.2 and 3](https://openai.com/policies/services-agreement/).

R's Azure “GO” label, automatic Together/DeepInfra prohibition, and GPU-hosting workaround are not adequately established by its citations. Hosting open-weight models still requires license, acceptable-use, hosting-contract, geography, and data-policy review; it adds capacity and operational costs. LiteLLM is routing software, not supplier permission. Do not migrate to GPUs merely to avoid a commercial discussion.

Replace “guaranteed suspension,” “structurally impossible,” and the arbitrary 30-day kill rule with evidence-based decisions: hold commercial traffic if no valid supplier route exists; reconsider the model if authorization or economics cannot be obtained on acceptable terms.

### 4. Financial analysis contains a reversed comparison

R §7 says NPR 0.069 per credit would be disastrously below cost if one credit equaled a token. Its own financial-model assumption is USD 2.50 per million tokens and NPR 135/USD. This equals NPR 337.50 per million, or **NPR 0.0003375 per token**. A price of approximately NPR 0.069 per token would be about 205 times that assumed cost. This is a unit error, not proof the company is profitable. Actual input/output rates, credit multipliers, and model mix remain unknown.

The proposed packs also have different effective rates if bonuses are additional: NPR 499 / 7,188 = approximately NPR 0.06942 per credit; NPR 999 / 16,887 = approximately NPR 0.05916. Verify whether displayed credit totals already include bonuses before using this arithmetic.

R's optimistic scenario produces NPR 1,593,750 contribution before listed operating costs across 5,000 users: NPR 318.75 per user. With NPR 1.1 million operating costs held constant, illustrative break-even is about **3,451 users**, not approximately 1,850. This is scenario arithmetic, not a forecast; costs and acquisition spending may change with scale. Its 1.5-month CAC payback cannot be derived without new-customer counts, retention, and incremental contribution.

Replace the model with request-level measurements: recognized usage revenue excluding collected VAT, less actual provider charges, FX/remittance costs, applicable nonrecoverable tax or contractual gross-up, payment fees, variable hosting, support, fraud, refunds, and promotional subsidy. Snapshot tariffs and FX policy per request. A 30% markup on cost creates 23.1% gross margin before other costs; it is not a 30% margin. A 15% revenue-share affiliate scheme could consume most of a thin margin.

Top-ups are cash inflows and prepaid service obligations, not automatically earned revenue or MRR. Define accounting treatment with the accountant. Track billings, earned usage revenue, unused paid balances, promotional credits, contribution, and available cash separately. R's consumer headcounts, 60% accessible share, 5% market capture, and spend assumptions are hypotheses with overlap risk; mixing individuals and organizations does not produce a defensible market size. Ten agencies with ten developer seats are ten paying accounts unless the seats independently pay.

### 5. Tax and banking claims need a written determination

R §5 treats USD 10,000 as a universal annual service-import ceiling and uses fixed 5%/15% withholding, 2% DST, and a NPR 2 million threshold. The report's sources do not establish that this entire treatment applies to AIsathi's entity, supplier, payment route, and review date. NRB policy describes sectoral and annual facilities, while IRD lists newer digital-service procedures and amendments. Do not hardcode these claims into pricing. [NRB policy](https://www.nrb.org.np/contents/uploads/2025/08/Monetary-policy-in-English-2025_26.pdf), [IRD procedures](https://ird.gov.np/category/digitalservicetax-1/).

Obtain a bank memo identifying the applicable circular, transaction classification, limits, documentation, approval route, and funding lead time. Obtain an accountant's memo covering VAT registration and eligibility, B2B versus B2C treatment, imported-service VAT where applicable, withholding classification/treaty treatment, gross-up obligations, tax timing on top-ups versus consumption, refunds/credit notes, and invoicing or electronic billing approval requirements.

Remove the sales claim “claim a 13% tax deduction.” Input VAT credit and income-tax expense deduction are different mechanisms and depend on eligibility. A PAN receipt is not interchangeable with a VAT tax invoice. A PDF with sequential numbering alone is not proof of tax compliance. Do not assume an AD/BS dual date or the proposed invoice prefix is legally mandatory without the accountant's specification.

### 6. Payment providers require different verification

S §1, SEC-001, and task 2.4 impose generic HMAC verification on every provider. eSewa ePay documents HMAC-SHA256 signatures and status verification. Khalti KPG-2 uses a return callback plus authenticated server-side lookup; its documented callback is not the same signed-webhook interface. Khalti specifically requires confirmed `Completed` status before service delivery. [eSewa](https://developer.esewa.com.np/pages/Epay), [Khalti](https://docs.khalti.com/khalti-epayment/).

For either flow, bind the provider result to a server-created order: expected amount, currency, merchant, environment, tenant, and unique provider transaction. Credit exactly once in a database transaction. Deduplicating arbitrary callback IDs is insufficient if different events represent the same payment. Model pending, expired, failed, refunded, partially refunded, duplicated, and out-of-order results. A return URL parameter is never sufficient proof of payment.

Use one already approved local provider for the pilot. Stripe's published availability list does not list Nepal; verify any supported foreign entity and real settlement arrangement before including Stripe in scope. [Stripe availability](https://stripe.com/global). Do not use a borrowed merchant account as a workaround. Add payment redundancy after proving the first flow.

## Technical corrections and hidden risks

### Durable accounting before fast caching

S calls TOPUP/API_USAGE/REFUND rows a double-entry ledger, but those labels do not define balanced postings. Specify accounts, transaction grouping, balancing rules, currency units, immutable corrections, and uniqueness constraints. A balance row lock and a nonnegative check do not prove conservation, settlement correctness, or protection of spend caps.

Choose one durable authority for funds and reservations. For a small pilot, a transactional PostgreSQL reservation and posting flow is a reasonable default; Redis can enforce rate limits. Redis Lua atomicity does not extend to PostgreSQL. If both store authoritative balances, define the failure/recovery protocol before implementation.

Essential invariants: accepted reservations never exceed available company funds or key budgets; each request settles or reverses at most once; each payment funds the account once; currency postings balance; adjustments are traceable; crashes leave discoverable pending work. Specify `reserved → in-flight → settled/released/needs-reconciliation` transitions. Reservation expiry must not free money while a billable upstream request continues.

Choose one unit: for example one micro-NPR = 0.000001 NPR. “Micro-paisa” and “micro-NPR” differ by a factor of 100. Use explicit conversion and rounding rules and test JavaScript BIGINT serialization if relevant. Do not migrate existing paid balances without a reconciled opening balance, migration rehearsal, rollback plan, and backups.

### Provider usage differs from visible output

S task 4.2 promises exact mid-disconnect counts based on delivered chunks; R's security test instead bills generated-but-undelivered tokens. Neither establishes a complete policy. Input, output, reasoning, caching, multimodal usage, and continued generation after cancellation can be billed differently.

Prefer provider-reported usage; persist provider request IDs and reconcile pending requests through a documented route. OpenRouter documents usage in the last SSE message and asynchronous lookup by generation ID. If that final message is lost, a local tokenizer cannot universally reconstruct final provider charges. [Usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting).

Define cancellation behavior, timeout limits, pending settlements, customer-visible estimates, reconciliation deadlines, and who absorbs unrecoverable uncertainty. Customer terms must explain whether billing follows generated usage, delivered usage, or another explicit rule. Budget any difference the platform absorbs.

A worst-case reservation requires bounded inputs and output plus model-specific tariffs; `prompt_tokens + max_tokens` alone is not a price. Include supported reasoning and other billable categories or exclude those routes from the pilot.

### Final stream cost cannot be an initial header

S task 4.2 proposes final cost and remaining-balance headers. HTTP headers are sent before completion, when final cost is unknown. Return request ID and explicitly labeled estimates initially. Publish final settlement through a usage endpoint/dashboard and, only where compatible, an agreed final SSE extension. Do not assume HTTP trailers or custom SSE events work with every SDK. Concurrent calls also make a “remaining balance” value a timestamped snapshot, not a continuing guarantee.

### Credentials and tenant boundaries

Random high-entropy tokens plus HMAC-SHA256 verification are a valid option, not “zero-knowledge” architecture. Define argument order explicitly as HMAC with the server secret as key and token as message. Use cryptographic randomness, a separate public key identifier, constant-time verification, secret versioning/rotation, and redacted logs. The proposed 12-character prefix contains seven fixed characters in `np_live_`, leaving only five random characters; do not make that short prefix the sole unique identifier.

Key caps must reserve concurrently across all company keys and have documented monthly reset, timezone, and total-limit rules. Handle revoke/cache races and active-stream policy. Protect owner login and internal admin controls; label-only `/internal` endpoints are not automatically private. Audit and restrict manual financial adjustments; never edit a balance without traceable compensating entries. IP restrictions, if added, must account for trusted proxies and shared NAT.

### Privacy and routing

An `X-AISathi-Zero-Retention` header does not enforce upstream privacy. Separate no training, no payload logging, chat-history storage, metadata retention, abuse monitoring, and provider retention. Verify the whole path: application, proxy/CDN, APM, error tracking, backups, support exports, temporary files, and crash capture. Keep necessary billing/security metadata under a defined policy without prompt bodies.

Enforce an eligible model/provider route and fail closed if it cannot satisfy the agreed privacy policy. Fallback must preserve region, model, permission, retention, and price constraints. OpenRouter documents endpoint-level ZDR routing, which reinforces that a model name alone does not establish retention behavior. [ZDR documentation](https://openrouter.ai/docs/guides/features/zdr).

Defer universal 300ms failover. A timeout may occur after provider acceptance, so another attempt can double cost. Retry only explicitly classified failures with bounded attempts; respect rate-limit backoff and never splice a second completion into a partially emitted answer. Measure time to first token, gateway overhead, stream success, and errors separately. Replace sub-2ms/sub-3ms/sub-30ms promises with measured budgets on representative infrastructure.

### Security assurance and accessibility

Test continuously rather than calling a last-week attack script a penetration audit. Include cross-tenant access to keys, usage, invoices, and exports; duplicate requests; callbacks racing settlement; worker death; database/Redis outages; lost callbacks; key revocation; cost caps; unknown final usage; provider suspension; and backup recovery. A nonnegative balance alone can conceal free provider usage or lost funds. Mock upstreams for hostile load and failure tests unless live testing is authorized under provider rules.

Prompt injection is not solved by a WAF. For a plain inference proxy its risk differs from an agent with tools. SSRF controls become relevant wherever the platform fetches user-supplied URLs, images, callbacks, or endpoints. Inventory those surfaces and restrict egress accordingly.

S's Lighthouse 95+ target cannot establish WCAG conformance. WCAG 2.2 AA target-size minimum is generally 24×24 CSS pixels with exceptions; 44×44 is a useful stronger design target. Test keyboard access, focus, form errors, contrast, and screen-reader labels directly. [W3C criterion 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

## Public claims and evidence quality

The current public AIsathi page shows “340+” alongside a link to “454 models,” so catalog consistency remains an observable issue. It shows “GPT-5.2,” not the report's “GPT-52.” Do not declare all listed model names fictitious from memory or replace them with old IDs. Verify exact current supplier model IDs, access, endpoint capabilities, and prices, then derive counts from the sellable catalog. The website still advertises broad drop-in compatibility; test the precise SDK operations you support. [AIsathi homepage](https://aisathi.io/).

Nuvaa's public page advertises developer integrations as well as consumer capabilities. That establishes positioning overlap, not market dominance, operational maturity, customer count, retention, or comparative reliability. R's claims of domination, high LTV, guaranteed workflow lock-in, and misconduct by another competitor exceed the supplied evidence. Remove unsubstantiated accusations. [Nuvaa homepage](https://nuvaa.ai/).

R cites dated tax articles, older OpenAI terms, secondary commentary, and unrelated companies' terms. Its conclusions deserve lower confidence than its scores suggest. The SOC 2 status of a supplier is not certification of AIsathi. OpenAI-compatible does not mean identical support for every tool, endpoint, multimodal feature, streaming event, or coding product. Publish a tested compatibility matrix.

## Corrected ownership

These assignments are proposals based on the names in the email; capacity and expertise still need confirmation.

- **Oscar Neupane:** product decisions, supplier permission, bank/accountant coordination, pilot recruitment, release accountability. Bali reviews commercial scope and public claims.
- **Pratik Chandra Thakur:** tenant authorization, credentials, durable reservations, ledger, payment verification and reconciliation. Livesh reviews failure handling and integration.
- **Bali Kumar Wad:** minimal dashboard, billing visibility, developer onboarding, documentation, verified public claims. Oscar reviews customer-facing commitments; Pratik reviews authorization and financial data contracts.
- **Livesh Jha:** gateway integration, usage reconciliation, infrastructure, privacy controls, monitoring, recovery drills, and failure testing. Pratik reviews settlement and cross-system behavior.

Every task needs one primary owner, a separate reviewer, an acceptance test, and evidence linked to the release checklist. The same engineer should not be the sole implementer and sole approver of their financial/security subsystem. This cross-review is useful but is not an independent security assessment.

## Prioritized 14-day sprint

### Days 1–2 — 30–31 October — establish viable scope

Oscar starts supplier, bank, accountant, and merchant verification immediately; identifies five qualified agencies/developers and seeks two or three concrete pilot commitments. Ask about their last real integration, payment problem, spend, privacy needs, and acceptable premium. Do not request access to their bank app.

Pratik and Livesh inventory what actually works today, review secrets/access and existing customer balances, define the reservation/settlement contract, allowed models, spending ceiling, and failure policy. Bali verifies catalog/copy and tests one SDK onboarding flow.

**Gate:** written scope, available team capacity, signed-off accounting invariants, named external blockers, supported model list, and a capped cost budget. External approval may remain pending; it blocks commercial activation rather than all internal work.

### Days 3–5 — 1–3 November — build one complete path

Pratik implements tenant boundaries, secure key creation/revocation, durable reservations, idempotent ledger posting, and one payment integration. Livesh integrates one approved inference route with rate limits, request IDs, strict input/output bounds, usage capture, cancellation, and sanitized telemetry. Bali connects the smallest balance/key/usage interface.

**Acceptance:** using a sandbox or approved test account, one verified payment funds exactly one account; one bounded API call reserves and settles correctly; duplicate events cannot double credit or settle; another account cannot access keys or billing records. Automate these checks now.

### Days 6–8 — 4–6 November — make failures recoverable

Pratik and Livesh test concurrent keys, cap races, crashed processes, lost final usage, delayed callbacks, refunds, cache loss, and provider errors. Add a durable reconciliation queue and restricted adjustment workflow. Oscar obtains the accountant-approved receipt/invoice process and precise privacy/refund wording. Bali publishes tested setup instructions, tariff explanation, and pending-settlement states.

**Acceptance:** injected failures preserve accounting invariants; every unresolved usage/payment item is discoverable with an owner; observed provider usage matches the priced bill or has an explained reconciliation state. Privacy checks show no payload capture in the configured path.

### Days 9–10 — 7–8 November — rehearse and freeze

Run a small authorized live top-up, completed inference, interrupted inference, and applicable refund/credit-note flow. Compare cash/payment records, internal postings, and supplier billing. Rehearse deployment rollback and backup restore. Oscar and Bali conduct pilot onboarding/UAT; Livesh captures baseline latency and error measurements.

**Acceptance:** one reproducible customer journey, restored data reconciles, support escalation works, and no unresolved critical/high issues affect the pilot flow. Freeze at Day 10 end. If an external dependency is pending, keep rehearsals in sandbox and mark paid activation blocked.

### Days 11–13 — 9–11 November — repair and prove release gates

Repair defects and rerun affected tests. Cross-review tenant security, billing, payment state transitions, secrets, privacy routing, and operational recovery. Complete human accessibility checks on critical flows. Publish an honest pilot limitations page. No new routing, membership, or reporting features.

**Acceptance:** evidence attached to each gate; no unexplained financial variance; cost and support caps configured; pilot customers know the limits and terms.

### Day 14 — 12 November — decide

Oscar makes a documented decision with financial/security reviewers. If gates pass, activate two or three invited pilot customers with limited models, modest prepaid exposure, and global/company/key caps. Five active companies is a stretch goal, not a reason to bypass controls.

If gates fail, retain a sandbox/waitlist and assign the next remediation milestone. Do not silently relabel a failed paid-launch gate as success. A pilot can start with manual invoicing only where the accountant confirms the process is valid and traceable.

## Release gates

1. **Commercial:** documented permission for the actual supplier route, applicable models and customer use; funded and bank-verified settlement path; approved merchant account; approved tax/invoice/refund process. A sales conversation alone is not sufficient.
2. **Money:** exactly-once payment funding and request settlement, balanced postings, concurrent company/key caps, durable recovery, and no unexplained reconciliation variance.
3. **Security/privacy:** tenant access tests and reviewer sign-off, protected secrets, effective revocation, payload-log controls, and enforcement of any promised provider retention conditions.
4. **Operations:** monitoring and alerts, named support/on-call responsibility, provider budget/availability alerts, restored backup and rollback rehearsal, and an emergency switch to stop billable requests.
5. **Customer/economics:** two or three qualified pilot commitments, tested onboarding, disclosed limits, measured request economics, and a founder-approved total loss/exposure budget. A consciously subsidized pilot needs an explicit budget; sustainable public pricing needs demonstrated positive contribution.

## Defer beyond this sprint

Full team/project administration, four-role RBAC, elaborate analytics/CSV exports, IP allowlist UI, a third payment rail, GPU hosting, RAG/agents, universal 300ms failover, broad model availability, blanket ZDR guarantees, SOC 2 implications, and contractual uptime credits. Keep automated legal invoicing only if already approved and inexpensive; otherwise use an approved manual process.

Retain essential server-side authorization, spending limits, secure credentials, valid billing documents, and traceable records. These are not optional polish.

## Days 15–60

- **Days 15–30:** observe real customer workflows; measure activation to successful call, paying organizations, seven/fourteen-day repeat usage, repurchase, realized contribution, support time, provider costs, and outstanding balances. Require several independent paying organizations and repeat behavior before widening exposure.
- **Days 31–45:** resolve demonstrated bottlenecks; add membership or a second payment/provider route only when validated. Price the recurring support and billing value separately if customers will pay for it.
- **Days 46–60:** consider a broader paid release if the gated pilot is stable, funded, repeatable, and profitable at the intended price. Define a real observation window for availability. A 99.5% internal target, a measured SLO, and a contractual SLA are different commitments; neither document proves a 99.9% service.

Do not fund broad paid acquisition, affiliate payouts, or hackathon giveaways until activation and contribution are measured. Replace arbitrary clone/demo targets with conversion and repeat-payment evidence. Keep the existing chat experience if useful; abandoning it is not a prerequisite to testing the API segment.

## Corrected team email

**Subject: AIsathi | 30 October–12 November B2B Pilot Readiness Sprint**

Hi Team,

I've attached the AIsathi Due Diligence Research and B2B Security Audit and Launch Plan for review. Please use the priorities below as the proposed sprint baseline where the documents conflict.

Our objective is to prepare a limited, secure B2B pilot for Nepali developers and small agencies with active API projects. The sprint runs from **30 October to 12 November 2026**. Day 14 is a **go/no-go review for an invited pilot**, with activation dependent on supplier permission, financial correctness, security, and operational readiness.

Our priorities are:

1. Confirm supplier permission for our actual gateway model, the bank/payment arrangements, and the accountant-approved tax and invoicing process.
2. Deliver one complete flow: verified local top-up, isolated company account, secure API key, bounded API request, durable credit reservation, and reconciled settlement.
3. Prove that tenant access controls, concurrent spending limits, duplicate payment handling, interrupted streams, and recovery work correctly.
4. Provide clear pricing, tested API onboarding, billing visibility, accurate privacy disclosures, and a working support process.

**Primary owners**

- **Oscar:** product coordination, supplier/bank/accountant dependencies, pilot recruitment, and release decisions.
- **Pratik:** tenant authorization, credentials, ledger/reservations, payment verification, and reconciliation.
- **Bali:** minimal dashboard, developer onboarding, billing visibility, documentation, and public claims.
- **Livesh:** gateway integration, usage recovery, infrastructure, monitoring, privacy controls, and failure testing.

Each deliverable will have a reviewer and an evidence-based acceptance check. Please flag capacity or expertise gaps before we lock assignments.

**Milestones**

- **31 October:** scope, accounting contracts, customer shortlist, and external dependencies documented.
- **3 November:** one complete sandbox payment-to-API flow working.
- **6 November:** concurrency, duplicate-event, interrupted-stream, and recovery checks passing for the scoped flow.
- **8 November:** UAT/recovery rehearsal and feature freeze; an authorized live payment test where dependencies permit.
- **9–11 November:** defect repair, cross-review, and release evidence.
- **12 November:** go/no-go decision; invite two or three pilot customers only if all release gates pass.

Full team administration, advanced failover, extra payment providers, and broad enterprise commitments are deferred. We will publish only privacy, compatibility, and reliability claims that we can substantiate.

By **5:00 PM Nepal Time on 30 October**, please confirm ownership, working availability, reviewer, and any access or external dependency that could affect your milestone. We will track blockers from Day 1 and adjust scope before adding features.

Best regards,

**Bali Kumar Wad**

*Draft for review; attachments must be added when sending. No recipient addresses were supplied, and no email has been sent.*
