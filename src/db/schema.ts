import { pgTable, uuid, text, jsonb, timestamp, boolean, pgEnum, integer, uniqueIndex, date, index } from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS
// ============================================================================

// Existing enums
export const roleEnum = pgEnum('role', ['admin', 'user']);
export const cohortStatusEnum = pgEnum('cohort_status', ['draft', 'ready', 'submitted', 'approved', 'closed']);
export const riskLevelEnum = pgEnum('risk_level', ['none', 'low', 'medium', 'high']);
export const alertSeverityEnum = pgEnum('alert_severity', ['critical', 'warning', 'info']);
export const alertTypeEnum = pgEnum('alert_type', ['wage_below_median', 'passport_expiry', 'ad_expired', 'other']);

// New enums for Work Permit refactor
export const appTypeEnum = pgEnum('app_type', [
    'WORK_PERMIT',
    'STUDY_PERMIT',
    'VISITOR',
    'PR_SPOUSAL',
    'EE_PROFILE',
    'EE_EAPR'
]);

export const processingContextEnum = pgEnum('processing_context', [
    'OUTSIDE_CANADA',
    'INSIDE_CANADA',
    'PORT_OF_ENTRY'
]);

export const actionIntentEnum = pgEnum('action_intent', [
    'APPLY',
    'EXTEND',
    'CHANGE_EMPLOYER',
    'CHANGE_CONDITIONS',
    'RESTORE'
]);

export const programTypeEnum = pgEnum('program_type', ['TFWP', 'IMP']);

export const authorizationModelEnum = pgEnum('authorization_model', ['EMPLOYER_SPECIFIC', 'OPEN']);

export const participantRoleEnum = pgEnum('participant_role', ['PRINCIPAL', 'SPOUSE', 'CHILD', 'SPONSOR']);

export const immigrationStatusTypeEnum = pgEnum('immigration_status_type', [
    'WORK_PERMIT',
    'STUDY_PERMIT',
    'VISITOR',
    'TRP',
    'PR'
]);

export const slotStateEnum = pgEnum('slot_state', [
    'missing',
    'uploaded',
    'in_review',
    'verified',
    'rejected',
    'expired'
]);

export const slotScopeEnum = pgEnum('slot_scope', ['PRINCIPAL', 'SPOUSE', 'EMPLOYER', 'APPLICATION']);

// ============================================================================
// TENANT & AUTH
// ============================================================================

export const organizations = pgTable('organizations', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    repName: text('rep_name'),
    repLicense: text('rep_license'),
    repEmail: text('rep_email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    role: roleEnum('role').default('user').notNull(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CORE ENTITIES
// ============================================================================

export const employers = pgTable('employers', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    companyName: text('company_name').notNull(),
    businessNumber: text('business_number'),
    address: jsonb('address'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const cohorts = pgTable('cohorts', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    employerId: uuid('employer_id').references(() => employers.id).notNull(),
    name: text('name').notNull(),
    jobDetails: jsonb('job_details'),
    status: cohortStatusEnum('status').default('draft').notNull(),
    riskLevel: riskLevelEnum('risk_level').default('none').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const applicants = pgTable('applicants', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    identity: jsonb('identity'),
    passport: jsonb('passport'),
    education: jsonb('education'),
    employment: jsonb('employment'),
    family: jsonb('family'),
    history: jsonb('history'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// PERSONS (NEW - First-class person entities)
// ============================================================================

export const persons = pgTable('persons', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    identity: jsonb('identity'), // { familyName, givenNames, dob, sex, maritalStatus }
    passport: jsonb('passport'), // { number, country, issueDate, expiryDate }
    contact: jsonb('contact'),   // { email, phone, address }
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// APPLICATIONS (Updated with typed columns)
// ============================================================================

export const applications = pgTable('applications', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicantId: uuid('applicant_id').references(() => applicants.id).notNull(),
    cohortId: uuid('cohort_id').references(() => cohorts.id),

    // Legacy field (keep for backwards compatibility)
    type: text('type').notNull(),
    status: text('status').default('draft').notNull(),

    // New typed fields
    appType: appTypeEnum('app_type'),
    processingContext: processingContextEnum('processing_context'),
    actionIntent: actionIntentEnum('action_intent'),
    programType: programTypeEnum('program_type'),
    authorizationModel: authorizationModelEnum('authorization_model'),
    subTypeCode: text('sub_type_code'),
    submittedAt: timestamp('submitted_at'),
    decisionAt: timestamp('decision_at'),

    // Snapshots
    applicantSnapshot: jsonb('applicant_snapshot'),
    jobSnapshot: jsonb('job_snapshot'),
    details: jsonb('details'),
    generatedPdfUrl: text('generated_pdf_url'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    generatedAt: timestamp('generated_at'),
});

// ============================================================================
// APPLICATION PARTICIPANTS (Links persons to applications)
// ============================================================================

export const applicationParticipants = pgTable('application_participants', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    personId: uuid('person_id').references(() => persons.id).notNull(),
    role: participantRoleEnum('role').default('PRINCIPAL').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// PERSON STATUSES (Status timeline for maintained status logic)
// ============================================================================

export const personStatuses = pgTable('person_statuses', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    personId: uuid('person_id').references(() => persons.id).notNull(),
    statusType: immigrationStatusTypeEnum('status_type').notNull(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'), // Key field for expiry/maintained status
    conditions: jsonb('conditions'),
    permitNumber: text('permit_number'),
    sourceDocumentFileId: uuid('source_document_file_id'),
    isCurrent: boolean('is_current').default(false),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// CASE EVENTS (Append-only audit log)
// ============================================================================

export const caseEvents = pgTable('case_events', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id),
    personId: uuid('person_id').references(() => persons.id),
    eventType: text('event_type').notNull(),
    occurredAt: timestamp('occurred_at').defaultNow().notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// SLOT DEFINITIONS (Template library)
// ============================================================================

export const slotDefinitions = pgTable('slot_definitions', {
    id: text('id').primaryKey(), // Stable key like 'wp.passport.biopage'
    appType: appTypeEnum('app_type').notNull(),
    processingContext: processingContextEnum('processing_context'),
    actionIntent: actionIntentEnum('action_intent'),
    programType: programTypeEnum('program_type'),
    authorizationModel: authorizationModelEnum('authorization_model'),
    subTypeCode: text('sub_type_code'),
    scope: slotScopeEnum('scope').default('PRINCIPAL').notNull(),
    isRequired: boolean('is_required').default(true).notNull(),
    validators: jsonb('validators'),
    helpText: text('help_text'),
    displayOrder: integer('display_order').default(0),
    groupName: text('group_name'),
    label: text('label').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// SLOT PACKS (Grouping of slot definitions)
// ============================================================================

export const slotPacks = pgTable('slot_packs', {
    id: text('id').primaryKey(),
    appType: appTypeEnum('app_type').notNull(),
    processingContext: processingContextEnum('processing_context'),
    actionIntent: actionIntentEnum('action_intent'),
    programType: programTypeEnum('program_type'),
    authorizationModel: authorizationModelEnum('authorization_model'),
    subTypeCode: text('sub_type_code'),
    matchPredicates: jsonb('match_predicates'),
    label: text('label').notNull(),
    isBase: boolean('is_base').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    matchIdx: index('slot_packs_match_idx').on(table.appType, table.processingContext, table.actionIntent),
}));

export const slotPackItems = pgTable('slot_pack_items', {
    packId: text('pack_id').references(() => slotPacks.id).notNull(),
    slotDefinitionId: text('slot_definition_id').references(() => slotDefinitions.id).notNull(),
    isRequiredOverride: boolean('is_required_override'),
    displayOrder: integer('display_order'),
}, (table) => ({
    packSlotUnique: uniqueIndex('slot_pack_items_pk').on(table.packId, table.slotDefinitionId),
    packIdx: index('slot_pack_items_pack_idx').on(table.packId),
}));

// ============================================================================
// SLOTS (Instances per application)
// ============================================================================

export const slots = pgTable('slots', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    personId: uuid('person_id').references(() => persons.id),
    slotDefinitionId: text('slot_definition_id').references(() => slotDefinitions.id).notNull(),
    state: slotStateEnum('state').default('missing').notNull(),
    isRequired: boolean('is_required').default(true).notNull(),
    dueAt: timestamp('due_at'),
    meta: jsonb('meta'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    uniqueSlot: uniqueIndex('slots_unique_idx').on(table.orgId, table.applicationId, table.personId, table.slotDefinitionId)
}));

// ============================================================================
// DOCUMENT FILES (Immutable file storage)
// ============================================================================

export const documentFiles = pgTable('document_files', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    sha256: text('sha256'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// DOCUMENT LINKS (Relationships - enables reuse)
// ============================================================================

export const documentLinks = pgTable('document_links', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    documentFileId: uuid('document_file_id').references(() => documentFiles.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id),
    slotId: uuid('slot_id').references(() => slots.id),
    personId: uuid('person_id').references(() => persons.id),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// WORK PERMIT ATTRIBUTES (1:1 with applications)
// ============================================================================

export const workPermitAttributes = pgTable('work_permit_attributes', {
    applicationId: uuid('application_id').references(() => applications.id).primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    programType: programTypeEnum('program_type'),
    authorizationModel: authorizationModelEnum('authorization_model'),
    subTypeCode: text('sub_type_code'),
    actionIntent: actionIntentEnum('action_intent'),
    requestedValidTo: date('requested_valid_to'),
    currentEmployerId: uuid('current_employer_id').references(() => employers.id),
    position: jsonb('position'), // { noc, teer, title, wage, location }
    authorizationArtifact: jsonb('authorization_artifact'), // { kind, refNumber, exemptionCode, expiresAt }
    insideCanadaContext: jsonb('inside_canada_context'), // { currentStatusType, currentStatusExpiresAt }
    openBasis: jsonb('open_basis'), // { basisCode, policyPack }
    outsideCanadaContext: jsonb('outside_canada_context'), // { countryOfResidence, countryOfCitizenship, hasLegalStatusInResidenceCountry }
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// STUDY PERMIT ATTRIBUTES (1:1 with applications)
// ============================================================================

export const studyPermitAttributes = pgTable('study_permit_attributes', {
    applicationId: uuid('application_id').references(() => applications.id).primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    program: jsonb('program'), // { dliNumber, institutionName, campusCity, credentialLevel, programName, startDate, endDate, tuitionFirstYear, deliveryMode }
    outsideCanadaContext: jsonb('outside_canada_context'), // { countryOfResidence, countryOfCitizenship }
    insideCanadaContext: jsonb('inside_canada_context'), // { currentStatusType, currentStatusExpiresAt, lastEntryDate }
    familyContext: jsonb('family_context'), // { hasAccompanyingSpouse, hasAccompanyingDependents }
    palTal: jsonb('pal_tal'), // { required, provinceOrTerritory, documentProvided }
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// APPLICATION EVALUATIONS (Cached rules engine output)
// ============================================================================

export const applicationEvaluations = pgTable('application_evaluations', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    evaluationData: jsonb('evaluation_data').notNull(), // Canonical JSON storage
    evaluatedAt: timestamp('evaluated_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// LEGACY DOCUMENTS TABLE (Keep for backwards compatibility)
// ============================================================================

export const documents = pgTable('documents', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    slotId: text('slot_id').notNull(),
    status: text('status').notNull(),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name').notNull(),
    fileSize: integer('file_size'),
    mimeType: text('mime_type'),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    metadata: jsonb('metadata'),
}, (table) => ({
    orgApplicationSlotUnique: uniqueIndex('documents_org_application_slot_unique').on(table.orgId, table.applicationId, table.slotId)
}));

// ============================================================================
// COMPLIANCE ALERTS
// ============================================================================

export const complianceAlerts = pgTable('compliance_alerts', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    cohortId: uuid('cohort_id').references(() => cohorts.id),
    severity: alertSeverityEnum('severity').notNull(),
    type: alertTypeEnum('type').notNull(),
    message: text('message').notNull(),
    isResolved: boolean('is_resolved').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at'),
});

// ============================================================================
// OCR EXTRACTION SYSTEM
// ============================================================================

export const extractionStatusEnum = pgEnum('extraction_status', [
    'queued',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
]);

export const proposalStatusEnum = pgEnum('proposal_status', [
    'pending',
    'accepted',
    'rejected',
    'superseded',
    'noop',
    'irrelevant'
]);

export const proposalSeverityEnum = pgEnum('proposal_severity', ['low', 'medium', 'high']);

export const targetEntityTypeEnum = pgEnum('target_entity_type', [
    'person',
    'person_status',
    'work_permit_attributes',
    'study_permit_attributes',
    'employer'
]);

export const documentExtractions = pgTable('document_extractions', {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    personId: uuid('person_id').references(() => persons.id),
    slotId: uuid('slot_id').references(() => slots.id),
    documentFileId: uuid('document_file_id').references(() => documentFiles.id).notNull(),

    // Provider & versioning
    provider: text('provider').default('documentai').notNull(),
    profileKey: text('profile_key').notNull(),
    engineVersion: text('engine_version').default('v1.0').notNull(),
    idempotencyKey: text('idempotency_key').unique().notNull(),

    // Job state
    status: text('status').default('queued').notNull(),
    attemptCount: integer('attempt_count').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at'),
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    // Payload
    rawJson: jsonb('raw_json'),
    textContent: text('text_content'),
    pagesJson: jsonb('pages_json'),
    extractedFieldsJson: jsonb('extracted_fields_json'),

    // Retention
    rawJsonExpiresAt: timestamp('raw_json_expires_at'),
    scrubbedAt: timestamp('scrubbed_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    appStatusIdx: index('idx_extractions_app_status').on(table.applicationId, table.status),
    docFileIdx: index('idx_extractions_doc_file').on(table.documentFileId, table.profileKey),
}));

export const factProposals = pgTable('fact_proposals', {
    id: uuid('id').defaultRandom().primaryKey(),
    schemaVersion: integer('schema_version').default(1).notNull(),
    orgId: uuid('org_id').references(() => organizations.id).notNull(),
    applicationId: uuid('application_id').references(() => applications.id).notNull(),
    personId: uuid('person_id').references(() => persons.id),
    extractionId: uuid('extraction_id').references(() => documentExtractions.id).notNull(),
    sourceDocumentFileId: uuid('source_document_file_id').references(() => documentFiles.id).notNull(),
    sourceSlotId: uuid('source_slot_id').references(() => slots.id),

    // Provenance
    sourceAnchor: jsonb('source_anchor'), // {pageIndex, bbox, snippet}

    // Targeting
    fieldKey: text('field_key').notNull(),
    targetEntityType: text('target_entity_type').notNull(),
    targetEntityId: uuid('target_entity_id'),
    fieldPath: text('field_path').notNull(),
    operation: text('operation').default('set').notNull(),

    // Values
    proposedValueJson: jsonb('proposed_value_json').notNull(),
    currentValueJson: jsonb('current_value_json'),
    confidence: text('confidence').notNull(), // Stored as text, parsed as number
    severity: text('severity').default('medium').notNull(),

    // Lifecycle
    status: text('status').default('pending').notNull(),
    reviewedByUserId: uuid('reviewed_by_user_id'),
    reviewedAt: timestamp('reviewed_at'),
    reviewReason: text('review_reason'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
    extractionFieldUnique: uniqueIndex('fact_proposals_extraction_field_unique').on(table.extractionId, table.fieldKey),
    appStatusIdx: index('idx_proposals_app_status').on(table.applicationId, table.status),
}));
