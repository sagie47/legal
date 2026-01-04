/**
 * Frozen DTO Contracts for Study Permit flows.
 *
 * These types define the Study Permit API contract.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type SlotScope = 'PRINCIPAL' | 'SPOUSE' | 'EMPLOYER' | 'APPLICATION';
export type SlotState = 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected' | 'expired';
export type ActionIntent = 'APPLY' | 'EXTEND' | 'RESTORE';
export type ProcessingContext = 'INSIDE_CANADA' | 'OUTSIDE_CANADA' | 'PORT_OF_ENTRY';
export type DeadlineSeverity = 'info' | 'warning' | 'critical';

// =============================================================================
// SLOT WITH DOCUMENT
// =============================================================================

export interface DocumentAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string | null;
    previewUrl: string;
    uploadedAt: string;
    uploadedBy: string | null;
}

export interface SlotWithDocument {
    id: string;
    definitionId: string;
    label: string;
    group: string;
    scope: SlotScope;
    required: boolean;
    state: SlotState;
    document: DocumentAttachment | null;
    meta?: {
        rejectionReason?: string;
        notes?: string;
    };
}

// =============================================================================
// EVALUATION
// =============================================================================

export interface EvaluationDerived {
    statusExpiryAt: string | null;
    recommendedApplyBy: string | null;
    isMaintainedStatusEligible: boolean;
    maintainedStatusConditions: 'SAME_AS_CURRENT' | 'NONE';
    restorationRequired: boolean;
    restorationDeadlineAt: string | null;
}

export interface Deadline {
    key: string;
    dueAt: string;
    severity: DeadlineSeverity;
    message: string;
}

export interface Blocker {
    code: string;
    message: string;
    slotId?: string;
    fieldKey?: string;
}

export interface Warning {
    code: string;
    message: string;
    slotId?: string;
}

export interface Evaluation {
    derived: EvaluationDerived;
    deadlines: Deadline[];
    blockers: Blocker[];
    warnings: Warning[];
    isReadyToSubmit: boolean;
}

// =============================================================================
// CASE EVENT
// =============================================================================

export interface CaseEvent {
    id: string;
    eventType: string;
    occurredAt: string;
    actorUserId: string | null;
    payload: Record<string, unknown> | null;
}

// =============================================================================
// STUDY PERMIT ATTRIBUTES
// =============================================================================

export interface StudyPermitProgram {
    dliNumber?: string;
    institutionName?: string;
    campusCity?: string;
    credentialLevel?: string;
    programName?: string;
    startDate?: string;
    endDate?: string;
    tuitionFirstYear?: number;
    deliveryMode?: string;
}

export interface StudyPermitAttributes {
    applicationId: string;
    program: StudyPermitProgram | null;
    outsideCanadaContext: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
    } | null;
    insideCanadaContext: {
        currentStatusType?: 'STUDY_PERMIT' | 'VISITOR' | 'WORK_PERMIT';
        currentStatusExpiresAt?: string;
        lastEntryDate?: string;
    } | null;
    familyContext: {
        hasAccompanyingSpouse?: boolean;
        hasAccompanyingDependents?: boolean;
    } | null;
    palTal: {
        required?: boolean;
        provinceOrTerritory?: string;
        documentProvided?: boolean;
    } | null;
}

// =============================================================================
// PERSON & STATUS
// =============================================================================

export interface PersonIdentity {
    familyName: string;
    givenNames: string;
    dob?: string;
    sex?: string;
    maritalStatus?: string;
}

export interface PersonStatus {
    statusType: string;
    validFrom: string | null;
    validTo: string | null;
    isCurrent: boolean;
    conditions?: Record<string, unknown>;
}

export interface Principal {
    personId: string;
    identity: PersonIdentity | null;
    passport: {
        number?: string;
        country?: string;
        expiryDate?: string;
    } | null;
    currentStatus: PersonStatus | null;
}

// =============================================================================
// BOOTSTRAP RESPONSE
// =============================================================================

export interface Application {
    id: string;
    orgId: string;
    status: string;
    appType: string | null;
    processingContext: ProcessingContext | null;
    actionIntent: ActionIntent | null;
    submittedAt: string | null;
    decisionAt: string | null;
    createdAt: string;
}

export interface StudyPermitBootstrapResponse {
    application: Application;
    studyPermitAttributes: StudyPermitAttributes | null;
    principal: Principal | null;
    slots: SlotWithDocument[];
    evaluation: Evaluation;
    events: CaseEvent[];
    extractionsSummary?: ExtractionSummary[];
    pendingProposals?: PendingProposal[];
}

// =============================================================================
// OCR EXTRACTION TYPES
// =============================================================================

export interface ExtractionSummary {
    slotId: string;
    fileId: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    profileKey: string;
    finishedAt: string | null;
}

export interface PendingProposal {
    id: string;
    fieldKey: string;
    targetEntityType: 'person' | 'person_status' | 'work_permit_attributes' | 'study_permit_attributes' | 'employer';
    proposedValue: unknown;
    currentValue: unknown | null;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    sourceAnchor: {
        pageIndex: number;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        snippet: string;
    } | null;
    sourceSlotId: string | null;
}

// =============================================================================
// UPDATE REQUEST/RESPONSE
// =============================================================================

export interface StudyPermitUpdateRequest {
    applicationId: string;
    actionIntent?: ActionIntent;
    currentStatusExpiresAt?: string;
    program?: StudyPermitProgram;
    outsideCanadaContext?: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
    };
    insideCanadaContext?: {
        currentStatusType?: 'STUDY_PERMIT' | 'VISITOR' | 'WORK_PERMIT';
        currentStatusExpiresAt?: string;
        lastEntryDate?: string;
    };
    familyContext?: {
        hasAccompanyingSpouse?: boolean;
        hasAccompanyingDependents?: boolean;
    };
    palTal?: {
        required?: boolean;
        provinceOrTerritory?: string;
        documentProvided?: boolean;
    };
}

export interface StudyPermitUpdateResponse {
    success: true;
    evaluation: Evaluation;
    slots: SlotWithDocument[];
}

// =============================================================================
// ATTACH FILE REQUEST/RESPONSE
// =============================================================================

export interface AttachFileRequest {
    slotId: string;
    documentFileId: string;
}

export interface AttachFileResponse {
    success: true;
    slot: SlotWithDocument;
}

// =============================================================================
// SUBMIT REQUEST/RESPONSE
// =============================================================================

export interface StudyPermitSubmitRequest {
    applicationId: string;
}

export interface StudyPermitSubmitSuccessResponse {
    success: true;
    evaluation: Evaluation;
}

export interface StudyPermitSubmitFailureResponse {
    success: false;
    blockers: Blocker[];
}

export type StudyPermitSubmitResponse = StudyPermitSubmitSuccessResponse | StudyPermitSubmitFailureResponse;
