import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface DocumentFile {
    id: string;
    orgId: string;
    storagePath: string;
    fileName: string;
    fileSize: number | null;
    mimeType: string | null;
    sha256: string | null;
    uploadedBy: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

export interface DocumentLink {
    id: string;
    orgId: string;
    documentFileId: string;
    applicationId: string | null;
    slotId: string | null;
    personId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface SlotWithDocument {
    slotId: string;
    slotDefinitionId: string;
    state: string;
    isRequired: boolean;
    label: string;
    groupName: string | null;
    helpText: string | null;
    document: DocumentFile | null;
}

// ============================================================================
// DOCUMENT FILE OPERATIONS
// ============================================================================

/**
 * Creates an immutable document file record after upload.
 */
export async function createDocumentFile(
    orgId: string,
    storagePath: string,
    fileName: string,
    options?: {
        fileSize?: number;
        mimeType?: string;
        sha256?: string;
        uploadedBy?: string;
        metadata?: Record<string, unknown>;
    }
): Promise<DocumentFile> {
    const { data, error } = await supabase
        .from('document_files')
        .insert({
            org_id: orgId,
            storage_path: storagePath,
            file_name: fileName,
            file_size: options?.fileSize,
            mime_type: options?.mimeType,
            sha256: options?.sha256,
            uploaded_by: options?.uploadedBy,
            metadata: options?.metadata,
        })
        .select()
        .single();

    if (error) throw error;
    return transformDocumentFile(data);
}

export async function getDocumentFile(fileId: string): Promise<DocumentFile | null> {
    const { data, error } = await supabase
        .from('document_files')
        .select('*')
        .eq('id', fileId)
        .single();

    if (error || !data) return null;
    return transformDocumentFile(data);
}

// ============================================================================
// DOCUMENT LINK OPERATIONS
// ============================================================================

/**
 * Links a document file to a slot. Deactivates any existing link for that slot.
 */
export async function attachFileToSlot(
    orgId: string,
    documentFileId: string,
    slotId: string,
    options?: {
        applicationId?: string;
        personId?: string;
    }
): Promise<DocumentLink> {
    // First, deactivate any existing active links for this slot
    await supabase
        .from('document_links')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('slot_id', slotId)
        .eq('is_active', true);

    // Create new active link
    const { data, error } = await supabase
        .from('document_links')
        .insert({
            org_id: orgId,
            document_file_id: documentFileId,
            slot_id: slotId,
            application_id: options?.applicationId,
            person_id: options?.personId,
            is_active: true,
        })
        .select()
        .single();

    if (error) throw error;

    // Update slot state to 'uploaded'
    await supabase
        .from('slots')
        .update({ state: 'uploaded', updated_at: new Date().toISOString() })
        .eq('id', slotId);

    return transformDocumentLink(data);
}

/**
 * Deactivates a document link (supersedes it).
 */
export async function deactivateLink(linkId: string): Promise<void> {
    const { error } = await supabase
        .from('document_links')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', linkId);

    if (error) throw error;
}

/**
 * Gets the active document link for a slot.
 */
export async function getActiveDocumentForSlot(slotId: string): Promise<DocumentFile | null> {
    const { data, error } = await supabase
        .from('document_links')
        .select('document_file_id')
        .eq('slot_id', slotId)
        .eq('is_active', true)
        .single();

    if (error || !data) return null;
    return getDocumentFile(data.document_file_id);
}

// ============================================================================
// SLOT OPERATIONS
// ============================================================================

/**
 * Gets all slots for an application with their associated documents and definitions.
 */
export async function getSlotsWithDocuments(applicationId: string): Promise<SlotWithDocument[]> {
    // Get slots with definitions
    // Note: PostgREST doesn't support ordering by nested relation, so we include display_order
    // in the select and sort client-side
    const { data: slots, error: slotsError } = await supabase
        .from('slots')
        .select(`
            id,
            slot_definition_id,
            state,
            is_required,
            slot_definitions (
                label,
                group_name,
                help_text,
                display_order
            )
        `)
        .eq('application_id', applicationId);

    if (slotsError || !slots) return [];

    // Get active document links
    const slotIds = slots.map(s => s.id);
    const { data: links } = await supabase
        .from('document_links')
        .select('slot_id, document_file_id')
        .in('slot_id', slotIds)
        .eq('is_active', true);

    // Get document files
    const fileIds = links?.map(l => l.document_file_id) || [];
    let files: DocumentFile[] = [];
    if (fileIds.length > 0) {
        const { data: filesData } = await supabase
            .from('document_files')
            .select('*')
            .in('id', fileIds);
        files = filesData?.map(transformDocumentFile) || [];
    }

    // Build file map
    const fileMap = new Map(files.map(f => [f.id, f]));
    const linkMap = new Map(links?.map(l => [l.slot_id, l.document_file_id]) || []);

    return slots.map(slot => {
        // Supabase foreign key joins can return object or array depending on relationship
        const rawDef = slot.slot_definitions;
        const def = Array.isArray(rawDef) ? rawDef[0] : rawDef;
        const fileId = linkMap.get(slot.id);
        return {
            slotId: slot.id,
            slotDefinitionId: slot.slot_definition_id,
            state: slot.state,
            isRequired: slot.is_required,
            label: def?.label || slot.slot_definition_id,
            groupName: def?.group_name || null,
            helpText: def?.help_text || null,
            document: fileId ? fileMap.get(fileId) || null : null,
        };
    });
}

/**
 * Updates slot state (for review workflow).
 */
export async function updateSlotState(
    slotId: string,
    state: 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected' | 'expired',
    meta?: { rejectionReason?: string; notes?: string }
): Promise<void> {
    const updateData: Record<string, unknown> = {
        state,
        updated_at: new Date().toISOString()
    };

    if (meta) {
        updateData.meta = meta;
    }

    const { error } = await supabase
        .from('slots')
        .update(updateData)
        .eq('id', slotId);

    if (error) throw error;
}

// ============================================================================
// SIGNED URL HELPERS
// ============================================================================

/**
 * Gets a signed URL for uploading a file.
 */
export async function getUploadUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(path);

    if (error) throw error;
    return data.signedUrl;
}

/**
 * Gets a signed URL for downloading a file.
 */
export async function getDownloadUrl(
    storagePath: string,
    expiresIn: number = 3600
): Promise<string> {
    // Parse bucket and path from storage_path
    const parts = storagePath.split('/');
    const bucket = parts[0];
    const path = parts.slice(1).join('/');

    const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data.signedUrl;
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformDocumentFile(data: Record<string, unknown>): DocumentFile {
    const fileSha256 =
        (data.file_sha256 as string | undefined) ??
        (data.hash_sha256 as string | undefined) ??
        (data.sha256 as string | undefined) ??
        null;

    return {
        id: data.id as string,
        orgId: data.org_id as string,
        storagePath: data.storage_path as string,
        fileName: data.file_name as string,
        fileSize: data.file_size as number | null,
        mimeType: data.mime_type as string | null,
        sha256: fileSha256,
        uploadedBy: data.uploaded_by as string | null,
        metadata: data.metadata as Record<string, unknown> | null,
        createdAt: data.created_at as string,
    };
}

function transformDocumentLink(data: Record<string, unknown>): DocumentLink {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        documentFileId: data.document_file_id as string,
        applicationId: data.application_id as string | null,
        slotId: data.slot_id as string | null,
        personId: data.person_id as string | null,
        isActive: data.is_active as boolean,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}
