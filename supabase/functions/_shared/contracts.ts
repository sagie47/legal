/**
 * Frozen DTO Contracts for WP Inside Canada Extend
 * 
 * THESE TYPES ARE THE API CONTRACT. Frontend renders these shapes directly.
 * Do not modify without versioning consideration.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type SlotScope = 'PRINCIPAL' | 'SPOUSE' | 'EMPLOYER' | 'APPLICATION';
export type SlotState = 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected' | 'expired';
export type ProgramType = 'IMP' | 'TFWP';
export type AuthorizationModel = 'EMPLOYER_SPECIFIC' | 'OPEN';
export type ActionIntent = 'APPLY' | 'EXTEND' | 'CHANGE_EMPLOYER' | 'CHANGE_CONDITIONS' | 'RESTORE';
export type ProcessingContext = 'INSIDE_CANADA' | 'OUTSIDE_CANADA' | 'PORT_OF_ENTRY';
export type DeadlineSeverity = 'info' | 'warning' | 'critical';

// =============================================================================
// SLOT WITH DOCUMENT (slot state + scope + active attachment + previewUrl)
// =============================================================================

export interface DocumentAttachment {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string | null;
    previewUrl: string;        // Signed URL (10 min TTL)
    uploadedAt: string;
    uploadedBy: string | null;
}

export interface SlotWithDocument {
    id: string;                 // Slot instance UUID
    definitionId: string;       // Stable key like 'wp.passport.biopage'
    label: string;
    group: string;              // 'Identity', 'Authorization', etc.
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
// EVALUATION (derived flags + deadlines + blockers/warnings + readiness)
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
    isReadyToSubmit: boolean;   // blockers.length === 0
}

// =============================================================================
// CASE EVENT (audit log)
// =============================================================================

export interface CaseEvent {
    id: string;
    eventType: string;
    occurredAt: string;
    actorUserId: string | null;
    payload: Record<string, unknown> | null;
}

// =============================================================================
// WORK PERMIT ATTRIBUTES
// =============================================================================

export interface WorkPermitAttributes {
    applicationId: string;
    programType: ProgramType | null;
    authorizationModel: AuthorizationModel | null;
    subTypeCode: string | null;
    actionIntent: ActionIntent | null;
    requestedValidTo: string | null;
    currentEmployerId: string | null;
    position: {
        noc?: string;
        teer?: string;
        title?: string;
        wage?: number;
        location?: string;
    } | null;
    authorizationArtifact: {
        kind: 'LMIA' | 'EMPLOYER_PORTAL_OFFER';
        refNumber?: string;
        exemptionCode?: string;
        expiresAt?: string;
        complianceFeePaid?: boolean;
    } | null;
    insideCanadaContext: {
        currentStatusType?: string;
        currentStatusExpiresAt?: string;
        lastEntryDate?: string;
    } | null;
    openBasis: {
        basisCode?: string;
        policyPack?: string;
    } | null;
    outsideCanadaContext: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
        hasLegalStatusInResidenceCountry?: boolean;
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
// WP BOOTSTRAP RESPONSE
// =============================================================================

export interface Application {
    id: string;
    orgId: string;
    status: string;
    appType: string | null;
    processingContext: ProcessingContext | null;
    submittedAt: string | null;
    decisionAt: string | null;
    createdAt: string;
}

export interface WorkPermitBootstrapResponse {
    application: Application;
    workPermitAttributes: WorkPermitAttributes | null;
    principal: Principal | null;
    slots: SlotWithDocument[];
    evaluation: Evaluation;
    events: CaseEvent[];        // Latest 25 or 7 days
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
    targetEntityType: 'person' | 'person_status' | 'work_permit_attributes' | 'employer';
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

export interface WorkPermitUpdateRequest {
    applicationId: string;
    programType?: ProgramType;
    authorizationModel?: AuthorizationModel;
    subTypeCode?: string;
    actionIntent?: ActionIntent;
    currentEmployerId?: string;
    currentStatusExpiresAt?: string;
    insideCanadaContext?: {
        currentStatusType?: string;
        currentStatusExpiresAt?: string;
        lastEntryDate?: string;
    };
    authorizationArtifact?: {
        kind?: 'LMIA' | 'EMPLOYER_PORTAL_OFFER';
        refNumber?: string;
        exemptionCode?: string;
    };
    openBasis?: {
        basisCode?: string;
        policyPack?: string;
    };
    outsideCanadaContext?: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
        hasLegalStatusInResidenceCountry?: boolean;
    };
}

export interface WorkPermitUpdateResponse {
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

export interface WorkPermitSubmitRequest {
    applicationId: string;
}

export interface WorkPermitSubmitSuccessResponse {
    success: true;
    evaluation: Evaluation;
}

export interface WorkPermitSubmitFailureResponse {
    success: false;
    blockers: Blocker[];
}

export type WorkPermitSubmitResponse = WorkPermitSubmitSuccessResponse | WorkPermitSubmitFailureResponse;
