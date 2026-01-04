import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentExtraction {
    id: string;
    orgId: string;
    applicationId: string;
    personId: string | null;
    slotId: string | null;
    documentFileId: string;
    provider: string;
    profileKey: string;
    engineVersion: string;
    idempotencyKey: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    attemptCount: number;
    nextAttemptAt: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    errorCode: string | null;
    errorMessage: string | null;
    extractedFieldsJson: Record<string, unknown> | null;
    createdAt: string;
}

export interface FactProposal {
    id: string;
    orgId: string;
    applicationId: string;
    personId: string | null;
    extractionId: string;
    sourceDocumentFileId: string;
    sourceSlotId: string | null;
    sourceAnchor: { pageIndex: number; bbox: object; snippet: string } | null;
    fieldKey: string;
    targetEntityType: 'person' | 'person_status' | 'work_permit_attributes' | 'study_permit_attributes' | 'employer';
    targetEntityId: string | null;
    fieldPath: string;
    operation: 'set' | 'append' | 'upsert_child';
    proposedValueJson: unknown;
    currentValueJson: unknown | null;
    confidence: number;
    severity: 'low' | 'medium' | 'high';
    status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'noop' | 'irrelevant';
    reviewedByUserId: string | null;
    reviewedAt: string | null;
    reviewReason: string | null;
    createdAt: string;
}

// ============================================================================
// IDEMPOTENCY KEY
// ============================================================================

const ENGINE_VERSION = 'v1.0';

/**
 * Compute idempotency key for client-side use.
 * Simple concatenation is sufficient since the server-side (attach-file) handles actual hashing.
 */
export function computeIdempotencyKey(
    fileSha256: string,
    profileKey: string,
    engineVersion: string = ENGINE_VERSION
): string {
    return `${fileSha256}:${profileKey}:${engineVersion}`;
}

// ============================================================================
// ENQUEUE EXTRACTION
// ============================================================================

interface EnqueueExtractionOptions {
    orgId: string;
    applicationId: string;
    documentFileId: string;
    slotId: string;
    profileKey: string;
    personId?: string | null;
    fileSha256?: string | null;
}

/**
 * Enqueues a document for OCR extraction.
 * Uses idempotency key to prevent duplicate runs.
 */
export async function enqueueExtraction(options: EnqueueExtractionOptions): Promise<DocumentExtraction | null> {
    const {
        orgId,
        applicationId,
        documentFileId,
        slotId,
        profileKey,
        personId = null,
        fileSha256,
    } = options;

    // If we don't have a file hash, we can't compute idempotency key
    // Fall back to using file ID + profile + version
    const hashSource = fileSha256 || documentFileId;
    const idempotencyKey = computeIdempotencyKey(hashSource, profileKey, ENGINE_VERSION);

    // Calculate retention window (30 days)
    const rawJsonExpiresAt = new Date();
    rawJsonExpiresAt.setDate(rawJsonExpiresAt.getDate() + 30);

    // Upsert - if idempotency key exists, do nothing (extraction already queued/processed)
    const { data, error } = await supabase
        .from('document_extractions')
        .upsert({
            org_id: orgId,
            application_id: applicationId,
            document_file_id: documentFileId,
            slot_id: slotId,
            person_id: personId,
            profile_key: profileKey,
            engine_version: ENGINE_VERSION,
            idempotency_key: idempotencyKey,
            status: 'queued',
            raw_json_expires_at: rawJsonExpiresAt.toISOString(),
        }, {
            onConflict: 'idempotency_key',
            ignoreDuplicates: true, // Don't update if already exists
        })
        .select()
        .single();

    if (error) {
        // If it's a duplicate, that's fine - extraction already exists
        if (error.code === '23505') { // unique_violation
            console.log('Extraction already exists for this file/profile combination');
            return null;
        }
        console.error('Failed to enqueue extraction:', error);
        throw error;
    }

    return transformExtraction(data);
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get pending extractions for an application.
 */
export async function getExtractionsByApplication(
    applicationId: string
): Promise<DocumentExtraction[]> {
    const { data, error } = await supabase
        .from('document_extractions')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(transformExtraction);
}

/**
 * Get extraction status summary for slots.
 */
export async function getExtractionSummary(
    applicationId: string
): Promise<{ slotId: string; fileId: string; status: string; profileKey: string; finishedAt: string | null }[]> {
    const { data, error } = await supabase
        .from('document_extractions')
        .select('slot_id, document_file_id, status, profile_key, finished_at')
        .eq('application_id', applicationId);

    if (error) throw error;
    return (data || []).map(row => ({
        slotId: row.slot_id,
        fileId: row.document_file_id,
        status: row.status,
        profileKey: row.profile_key,
        finishedAt: row.finished_at,
    }));
}

// ============================================================================
// PROPOSAL FUNCTIONS
// ============================================================================

/**
 * Get pending proposals for an application.
 */
export async function getPendingProposals(
    applicationId: string
): Promise<FactProposal[]> {
    const { data, error } = await supabase
        .from('fact_proposals')
        .select('*')
        .eq('application_id', applicationId)
        .in('status', ['pending'])
        .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []).map(transformProposal);
}

/**
 * Get all proposals for an application (for history).
 */
export async function getAllProposals(
    applicationId: string,
    options?: { limit?: number }
): Promise<FactProposal[]> {
    let query = supabase
        .from('fact_proposals')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false });

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(transformProposal);
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformExtraction(data: Record<string, unknown>): DocumentExtraction {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        applicationId: data.application_id as string,
        personId: data.person_id as string | null,
        slotId: data.slot_id as string | null,
        documentFileId: data.document_file_id as string,
        provider: data.provider as string,
        profileKey: data.profile_key as string,
        engineVersion: data.engine_version as string,
        idempotencyKey: data.idempotency_key as string,
        status: data.status as DocumentExtraction['status'],
        attemptCount: data.attempt_count as number,
        nextAttemptAt: data.next_attempt_at as string | null,
        startedAt: data.started_at as string | null,
        finishedAt: data.finished_at as string | null,
        errorCode: data.error_code as string | null,
        errorMessage: data.error_message as string | null,
        extractedFieldsJson: data.extracted_fields_json as Record<string, unknown> | null,
        createdAt: data.created_at as string,
    };
}

function transformProposal(data: Record<string, unknown>): FactProposal {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        applicationId: data.application_id as string,
        personId: data.person_id as string | null,
        extractionId: data.extraction_id as string,
        sourceDocumentFileId: data.source_document_file_id as string,
        sourceSlotId: data.source_slot_id as string | null,
        sourceAnchor: data.source_anchor as FactProposal['sourceAnchor'],
        fieldKey: data.field_key as string,
        targetEntityType: data.target_entity_type as FactProposal['targetEntityType'],
        targetEntityId: data.target_entity_id as string | null,
        fieldPath: data.field_path as string,
        operation: data.operation as FactProposal['operation'],
        proposedValueJson: data.proposed_value_json,
        currentValueJson: data.current_value_json,
        confidence: parseFloat(data.confidence as string),
        severity: data.severity as FactProposal['severity'],
        status: data.status as FactProposal['status'],
        reviewedByUserId: data.reviewed_by_user_id as string | null,
        reviewedAt: data.reviewed_at as string | null,
        reviewReason: data.review_reason as string | null,
        createdAt: data.created_at as string,
    };
}
