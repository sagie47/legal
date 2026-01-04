OCR → Fact Extraction → Reconciliation Spec (WP Extend)
0) Goal

Turn uploaded evidence (PDF/image) into reviewable, auditable “fact proposals” that can update the canonical case graph (persons, statuses, work permit attributes, employers) without manual re-entry.

Core principle:
Documents are evidence. The database is truth.
Extraction produces suggestions; only an explicit review action updates canonical tables.

Primary target flow

Work Permit — Inside Canada — Extend (principal first, expand later to spouse/employer).

1) System Concepts
1.1 Evidence vs Truth

Evidence: document_files (immutable file records) + document_links (slot attachments)

Truth: canonical tables (e.g., persons, person_statuses, work_permit_attributes, employers)

Extraction: machine output artifact derived from a file (DocAI response + normalized fields)

Proposal: field-level suggested updates from an extraction, linked to target entity and field

1.2 UX Mental Model

WPExtendPage is a Data Reconciliation Center:

shows “Current fact” vs “Proposed fact”

user accepts/rejects per field (or bulk “Accept safe”)

every accepted update is logged and traceable to a specific document + extraction

2) Pipeline Overview
2.1 Trigger

After a file is attached to a slot (server-side, in attach-file):

Attach/replace active document_link

Update slot state to uploaded

If slot has an extraction profile and uses_new_docs=true:

enqueue an extraction by inserting/upserting document_extractions with status=queued

2.2 Processing (Worker on Google Cloud Run)

Worker polls queued extractions and executes:

Fetch file from Supabase Storage (signed URL)

Run Google Document AI: Enterprise Document OCR

Normalize results (dates/IDs/casing)

Persist extraction artifact

Generate fact proposals using:

extraction profile (slot-driven)

case context (application_id + person_id)

conflict detection against canonical truth

2.3 Review + Apply (Server-authoritative)

User reviews proposals in UI.
Accept/reject goes through one server action:

validates authorization + conflicts

writes to canonical truth

marks proposal resolved

emits audit events

triggers evaluation refresh (or next bootstrap)

3) Data Model
3.1 document_extractions (job + result artifact)

One table for both queue and results to minimize joins and drift.

Columns

id uuid pk

org_id uuid indexed

application_id uuid indexed

person_id uuid nullable indexed (context used to generate proposals; extraction remains document-centric)

slot_id uuid nullable indexed (what triggered this run)

document_file_id uuid indexed fk

provider text (e.g., documentai)

profile_key text (e.g., passport_v1, wp_current_permit_v1)

engine_version text (your internal version + vendor model version)

idempotency_key text unique
= hash(file_sha256 + profile_key + engine_version)
(requires document_files.file_sha256 or equivalent)

status enum: queued | processing | succeeded | failed | cancelled

attempt_count int default 0

next_attempt_at timestamp nullable

error_code text nullable

error_message text nullable

started_at timestamp nullable

finished_at timestamp nullable

Payload

raw_json jsonb nullable (vendor response; short retention)

text_content text nullable (optional; default not stored long-term)

pages_json jsonb nullable (anchors/bboxes/structured layout)

extracted_fields_json jsonb nullable (normalized key-value candidates + confidence)

Retention / scrubbing

raw_json_expires_at timestamp nullable

scrubbed_at timestamp nullable

scrub_strategy text nullable (delete_raw_json, redact_sensitive, …)

Timestamps

created_at, updated_at

Constraints / indexes

unique(idempotency_key)

index(application_id, status)

index(document_file_id, profile_key)

index(next_attempt_at)

3.2 fact_proposals (review layer)

Field-level suggestions to update canonical truth.

Columns

id uuid pk

schema_version int default 1 (future-proof)

org_id uuid indexed

application_id uuid indexed

person_id uuid nullable indexed

extraction_id uuid indexed fk

source_document_file_id uuid indexed

source_slot_id uuid nullable

Provenance

source_anchor jsonb nullable with format:

pageIndex: int (0-based)

bbox: { x0, y0, x1, y1 } normalized 0..1

snippet: string (max 120 chars)

Targeting

field_key text (stable semantic key, e.g. person.passport.expiryDate)

target_entity_type enum: person | person_status | work_permit_attributes | employer

target_entity_id uuid nullable (resolved or resolvable deterministically)

field_path text (JSON path/pointer inside entity blobs or column identifier)

operation enum: set | append | upsert_child

Values

proposed_value_json jsonb

current_value_json jsonb nullable (snapshot at proposal creation time)

confidence numeric 0..1

severity enum: low | medium | high

Lifecycle

status enum:

pending | accepted | rejected | superseded | noop | irrelevant

reviewed_by_user_id uuid nullable

reviewed_at timestamp nullable

review_reason text nullable

Timestamps

created_at, updated_at

Constraints / indexes

unique(extraction_id, field_key)

index(application_id, status)

index(field_key)

4) Trigger & Enqueue Rules
4.1 Enqueue conditions

When attach-file completes:

require applications.uses_new_docs = true

require slot definition has extraction_profile.profile_key

require document_files.file_sha256 available (or add it)

4.2 Enqueue behavior

Insert document_extractions with:

status=queued

raw_json_expires_at = now + retention_window (e.g., 30 days)

idempotency_key computed

If idempotency_key already exists:

do not re-run OCR

optionally re-generate proposals for new case context (see 6.4)

5) Worker Execution (Cloud Run)
5.1 Poll criteria

Fetch document_extractions where:

status = queued

next_attempt_at is null OR <= now
Order by created_at.

5.2 Steps

Mark processing, set started_at, increment attempt

Fetch file bytes (Supabase Storage signed URL)

Call Document AI Enterprise Document OCR

Normalize:

Dates → ISO YYYY-MM-DD

IDs (UCI/passport) → uppercase, strip spaces/dashes where appropriate

Currency/numbers → normalized formats

Store:

pages_json with anchors/bboxes

extracted_fields_json with normalized candidates + confidence

optionally text_content (default off)

raw_json until scrub

Generate proposals:

Resolve targets deterministically (Section 6)

Snapshot current canonical values into current_value_json

Create proposals as pending or noop

Apply supersession rules (Section 7)

Mark extraction succeeded, set finished_at

Emit case_events: OCR_COMPLETED (and OCR_FAILED on errors)

5.3 Retry policy

max attempts: 3

exponential backoff: 1m → 5m → 30m (set next_attempt_at)

after max attempts: set failed, keep error_*

6) Deterministic Target Resolution
6.1 Purpose

Avoid ambiguity in multi-person cases. Proposals must map reliably to principal/spouse/employer/application.

6.2 Resolution rule order

If target_entity_id is already set → use it

Else resolve via slot scope (preferred):

derive scope from source_slot_id → slot instance metadata:

scope = PRINCIPAL | SPOUSE | EMPLOYER | APPLICATION

optionally participant_person_id

If scope maps to people:

PRINCIPAL → application_participants where role=principal

SPOUSE → role=spouse

DEPENDENT → role=dependent (future)

EMPLOYER → employer linked by work_permit_attributes or application relationship

APPLICATION → work_permit_attributes row for application

6.3 Failure handling

If no match → proposal creation fails with target_unresolved (log and skip)

If multiple matches → ambiguous_target (do not guess)

7) Proposal Lifecycle, Supersession, Relevance
7.1 Proposal identity key

Define:
proposal_key = (application_id, target_entity_type, target_entity_id, field_key)

7.2 Supersession policy

When generating new proposals:

If an older proposal exists with same proposal_key and status=pending:

mark old as superseded

create new as pending

If older proposal is accepted:

keep it

create new pending proposal if evidence suggests a different value

UI shows “new evidence suggests a change”

7.3 No-op policy

If proposed_value == current canonical value at generation time:

set status noop

do not surface in UI

7.4 Slot retirement relevance

If a slot becomes retired / no longer required:

proposals from that slot become irrelevant

they remain in history but stop surfacing as “action needed”

Implementation:

on slot retirement, worker or server action can mark related pending proposals irrelevant

or compute relevance at bootstrap time and filter from main UI

8) Canonical Write Path (Single Server Action)
8.1 New Edge Function (required)

POST /functions/v1/fact-proposals/resolve

Input

proposalId

action: accept | reject

overrideValueJson? (optional; only on accept)

reason? (required for reject and for high-severity overrides)

8.2 Authorization rules

user must belong to proposal.org_id

optional: require role admin for some entities (configurable)

8.3 Conflict detection on accept (compare-on-accept)

On accept:

read current canonical value at proposal.field_path

compare to proposal.current_value_json

Cases:

If matches → proceed

If differs and current already equals proposed → mark proposal noop (already applied)

If differs and current differs from proposed → return conflict_current_changed
UI must re-confirm using override or regenerate proposals

8.4 Apply write + audit

On successful accept:

write to canonical table/JSON path (operation: set/append/upsert_child)

mark proposal accepted, set reviewer + timestamps

emit FACT_ACCEPTED event with proposal_id, extraction_id, document_file_id, field_key

On reject:

mark proposal rejected, reason required for severity high

emit FACT_REJECTED

Hard rule: UI must not write canonical data directly.

9) UI Spec (WPExtendPage Reconciliation)
9.1 What to show

A “Suggestions” panel grouped by:

Principal

Application

Employer (if relevant)

Each proposal shows:

Field label

Current value

Proposed value

Confidence %

Source (file name + page + highlight anchor)

Actions: Accept / Reject

9.2 Bulk accept

Provide “Accept all safe” with policy:

confidence ≥ 0.90

severity != high

no conflicts

not irrelevant

9.3 Severity/confidence behaviors

severity high → always explicit accept (no bulk by default)

confidence < 0.80 → highlight and require explicit accept

conflict → require explicit override

9.4 Refresh behavior

After accept/reject:

re-bootstrap to reflect canonical updates + evaluation changes

10) Extraction Profiles (MVP)
10.1 passport_v1 (principal)

Extract

person.identity.familyName

person.identity.givenNames

person.identity.dob (ISO)

person.identity.sex

person.passport.number (uppercase)

person.passport.country

person.passport.issueDate (optional)

person.passport.expiryDate (ISO)

Severity

high: passport number, DOB, expiry

medium: names, country

low: issue date

10.2 wp_current_permit_v1 (principal)

Extract

person_status.expiresAt (ISO) — high severity

optional: statusType / restrictions if clearly present

10.3 Later (post-MVP)

lmia_or_offer_v1

paystub_v1

IMM form-specific profiles if needed

11) Bootstrapping / API Output
11.1 Bootstrap additions

Extend WorkPermitBootstrapResponse with:

extractionsSummary (per slot/file): status, profile_key, finished_at

pendingProposals list (filtered to relevant, non-superseded)

Do not return full raw_json or full text_content by default.

12) Audit & Compliance
12.1 Events to emit

OCR: OCR_QUEUED, OCR_COMPLETED, OCR_FAILED

Proposals: FACT_ACCEPTED, FACT_REJECTED

Document lifecycle already exists (attached/removed/verified/rejected)

12.2 Data retention

Default:

keep extracted_fields_json, anchors, proposal history long-term

scrub raw_json after retention window (e.g., 30 days)

do not store long-term full text_content unless explicitly enabled

13) Acceptance Tests (MVP)
A) Happy path

Create WP Extend case

Upload passport to slot

Extraction succeeds

Proposals appear

Accept passport expiry

Canonical updated + evaluation updated

B) Idempotency

attach same file again → no new extraction run (reused by idempotency key)

C) Conflicts

canonical differs from proposal snapshot → accept returns conflict and requires override

D) Retirement relevance

switch dimensions and retire a slot → proposals from retired slot stop surfacing in main UI

E) Signed URL expiry (docs)

preview after 10+ minutes triggers re-bootstrap/resign

14) Implementation Order (Recommended)

Add document_extractions + fact_proposals tables + indexes

Enqueue extraction on attach-file

Cloud Run worker: DocAI OCR → extractions → proposals

Add proposals to wp-bootstrap response

Build reconciliation UI

Add fact-proposals/resolve edge function (canonical write path)

Add scrub job for raw_json retention

Expand profiles after MVP validates workflow