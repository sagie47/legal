/**
 * Study Permit Edge Function Client
 *
 * TypeScript client for calling the Study Permit Edge Functions.
 */

import { supabase } from '../lib/supabase';
import { computeFileSha256 } from '../utils/crypto';

// =============================================================================
// TYPES
// =============================================================================

export type SlotScope = 'PRINCIPAL' | 'SPOUSE' | 'EMPLOYER' | 'APPLICATION';
export type SlotState = 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected' | 'expired';
export type ActionIntent = 'APPLY' | 'EXTEND' | 'RESTORE';
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

export interface StudyPermitAttributes {
    applicationId: string;
    program: {
        dliNumber?: string;
        institutionName?: string;
        campusCity?: string;
        credentialLevel?: string;
        programName?: string;
        startDate?: string;
        endDate?: string;
        tuitionFirstYear?: number;
        deliveryMode?: string;
    } | null;
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
    extractionsSummary?: {
        slotId: string;
        fileId: string;
        status: string;
        profileKey: string;
        finishedAt: string | null;
    }[];
    pendingProposals?: {
        id: string;
        fieldKey: string;
        targetEntityType: string;
        proposedValue: unknown;
        currentValue: unknown | null;
        confidence: number;
        severity: string;
        sourceAnchor: { pageIndex: number; bbox: object; snippet: string } | null;
        sourceSlotId: string | null;
    }[];
}

export interface StudyPermitUpdateRequest {
    applicationId: string;
    actionIntent?: ActionIntent;
    currentStatusExpiresAt?: string;
    program?: StudyPermitAttributes['program'];
    outsideCanadaContext?: StudyPermitAttributes['outsideCanadaContext'];
    insideCanadaContext?: StudyPermitAttributes['insideCanadaContext'];
    familyContext?: StudyPermitAttributes['familyContext'];
    palTal?: StudyPermitAttributes['palTal'];
}

export interface StudyPermitUpdateResponse {
    success: true;
    evaluation: Evaluation;
    slots: SlotWithDocument[];
}

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

// =============================================================================
// API CLIENT
// =============================================================================

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

export async function spBootstrap(applicationId: string): Promise<StudyPermitBootstrapResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(
        `${FUNCTIONS_URL}/sp-bootstrap?applicationId=${encodeURIComponent(applicationId)}`,
        { headers }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export async function spUpdate(request: StudyPermitUpdateRequest): Promise<StudyPermitUpdateResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/sp-update`, {
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

export async function spSubmit(applicationId: string): Promise<StudyPermitSubmitResponse> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/sp-submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ applicationId }),
    });

    if (response.status === 400) {
        return response.json();
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export async function uploadAndAttach(
    orgId: string,
    applicationId: string,
    slotId: string,
    file: File
) {
    const fileSha256 = await computeFileSha256(file);

    const storagePath = `${orgId}/${applicationId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file);

    if (uploadError) throw uploadError;

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

    const headers = await getAuthHeaders();
    const response = await fetch(`${FUNCTIONS_URL}/attach-file`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ slotId, documentFileId: docFile.id }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export function groupSlotsByGroup(slots: SlotWithDocument[]): Map<string, SlotWithDocument[]> {
    const groups = new Map<string, SlotWithDocument[]>();

    for (const slot of slots) {
        const existing = groups.get(slot.group) || [];
        existing.push(slot);
        groups.set(slot.group, existing);
    }

    return groups;
}

export function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-CA');
}

export function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
