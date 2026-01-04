/**
 * WP Edge Function Client
 * 
 * TypeScript client for calling the Work Permit Edge Functions.
 * This is the frontend's interface to the WP API.
 */

import { supabase } from '../lib/supabase';
import { computeFileSha256 } from '../utils/crypto';

// =============================================================================
// TYPES (mirrored from contracts.ts for frontend usage)
// =============================================================================

export type SlotScope = 'PRINCIPAL' | 'SPOUSE' | 'EMPLOYER' | 'APPLICATION';
export type SlotState = 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected' | 'expired';
export type ProgramType = 'IMP' | 'TFWP';
export type AuthorizationModel = 'EMPLOYER_SPECIFIC' | 'OPEN';
export type ActionIntent = 'APPLY' | 'EXTEND' | 'CHANGE_EMPLOYER' | 'CHANGE_CONDITIONS' | 'RESTORE';
export type DeadlineSeverity = 'info' | 'warning' | 'critical';

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

export interface CaseEvent {
    id: string;
    eventType: string;
    occurredAt: string;
    actorUserId: string | null;
    payload: Record<string, unknown> | null;
}

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

export interface Principal {
    personId: string;
    identity: {
        familyName: string;
        givenNames: string;
        dob?: string;
        sex?: string;
        maritalStatus?: string;
    } | null;
    passport: {
        number?: string;
        country?: string;
        expiryDate?: string;
    } | null;
    currentStatus: {
        statusType: string;
        validFrom: string | null;
        validTo: string | null;
        isCurrent: boolean;
        conditions?: Record<string, unknown>;
    } | null;
}

export interface Application {
    id: string;
    orgId: string;
    status: string;
    appType: string | null;
    processingContext: string | null;
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
    events: CaseEvent[];
}

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

export interface AttachFileRequest {
    slotId: string;
    documentFileId: string;
}

export interface AttachFileResponse {
    success: true;
    slot: SlotWithDocument;
}

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

// =============================================================================
// API CLIENT
// =============================================================================

// Get functions URL from Supabase URL
const getSupabaseUrl = (): string => {
    // @ts-ignore - Vite env
    return import.meta.env?.VITE_SUPABASE_URL || '';
};
const FUNCTIONS_URL = getSupabaseUrl().replace('.supabase.co', '.supabase.co/functions/v1');

async function getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Not authenticated');
    }
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    };
}

/**
 * Bootstrap the WP Extend page with all necessary data.
 */
export async function wpBootstrap(applicationId: string): Promise<WorkPermitBootstrapResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${FUNCTIONS_URL}/wp-bootstrap?applicationId=${encodeURIComponent(applicationId)}`,
        { headers }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Update WP dimensions/attributes and regenerate slots.
 */
export async function wpUpdate(request: WorkPermitUpdateRequest): Promise<WorkPermitUpdateResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/wp-update`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Attach a document file to a slot.
 */
export async function attachFile(request: AttachFileRequest): Promise<AttachFileResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/attach-file`, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Submit the application. Returns blockers if not ready.
 */
export async function wpSubmit(applicationId: string): Promise<WorkPermitSubmitResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/wp-submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ applicationId }),
    });

    // 400 is expected when blockers exist
    if (response.status === 400) {
        return response.json();
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Update slot state (verify/reject). Uses direct Supabase call.
 */
export async function updateSlotState(
    slotId: string,
    state: 'verified' | 'rejected' | 'in_review',
    meta?: { rejectionReason?: string; notes?: string }
): Promise<void> {
    const { error } = await supabase
        .from('slots')
        .update({
            state,
            meta,
            updated_at: new Date().toISOString()
        })
        .eq('id', slotId);

    if (error) throw error;
}

/**
 * Upload a file and attach it to a slot.
 * Handles: storage upload → document_files insert → attachFile Edge Function
 */
export async function uploadAndAttach(
    orgId: string,
    applicationId: string,
    slotId: string,
    file: File
): Promise<AttachFileResponse> {
    const fileSha256 = await computeFileSha256(file);

    // 1. Upload to storage
    const storagePath = `${orgId}/${applicationId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

    if (uploadError) throw uploadError;

    // 2. Create document_files record
    const { data: docFile, error: insertError } = await supabase
        .from('document_files')
        .insert({
            org_id: orgId,
            storage_path: storagePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
            sha256: fileSha256 || null,
        })
        .select()
        .single();

    if (insertError || !docFile) {
        throw insertError || new Error('Failed to create document record');
    }

    // 3. Attach to slot via Edge Function
    return attachFile({ slotId, documentFileId: docFile.id });
}

/**
 * Groups slots by their group name for UI rendering.
 */
export function groupSlotsByGroup(slots: SlotWithDocument[]): Map<string, SlotWithDocument[]> {
    const groups = new Map<string, SlotWithDocument[]>();

    for (const slot of slots) {
        const existing = groups.get(slot.group) || [];
        existing.push(slot);
        groups.set(slot.group, existing);
    }

    return groups;
}

/**
 * Gets the highest severity deadline.
 */
export function getUrgentDeadline(deadlines: Deadline[]): Deadline | null {
    const critical = deadlines.find(d => d.severity === 'critical');
    if (critical) return critical;

    const warning = deadlines.find(d => d.severity === 'warning');
    if (warning) return warning;

    return deadlines[0] || null;
}

/**
 * Formats a date string for display.
 */
export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA'); // YYYY-MM-DD format
}

/**
 * Gets days until a date.
 */
export function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
