import { supabase } from '../lib/supabase';
import { UploadedFile } from '../context/CaseContext';

// Define the DB shape locally since we can't import Drizzle types in frontend easily if they rely on backend libs
// effectively mirroring schema.ts
interface DocumentRecord {
    id: string;
    org_id: string;
    application_id: string;
    slot_id: string;
    status: string;
    storage_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploaded_by?: string;
    created_at: string;
    updated_at: string;
    metadata?: any;
}

/**
 * Creates or Updates a document record in the database via Supabase.
 */
export const createDocumentRecord = async (
    data: {
        orgId: string;
        applicationId: string;
        slotId: string;
        status: string;
        storagePath: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        uploadedBy?: string;
    }
) => {
    const now = new Date().toISOString();

    // Enforced by DB unique constraint: (org_id, application_id, slot_id)
    const { data: upserted, error } = await supabase
        .from('documents')
        .upsert(
            {
                org_id: data.orgId,
                application_id: data.applicationId,
                slot_id: data.slotId,
                status: data.status,
                storage_path: data.storagePath,
                file_name: data.fileName,
                file_size: data.fileSize,
                mime_type: data.mimeType,
                uploaded_by: data.uploadedBy,
                updated_at: now
            },
            { onConflict: 'org_id,application_id,slot_id' }
        )
        .select()
        .single();

    if (error) throw error;
    return upserted;
};

/**
 * Fetches all documents for a specific application.
 * Returns them mapped as a Record<slotId, UploadedFile> for the Context.
 */
export const getDocumentsForApplication = async (applicationId: string): Promise<Record<string, UploadedFile>> => {
    // Validate UUID format to prevent DB errors with mock data (e.g. "app_1")
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(applicationId);

    if (!isUuid) {
        console.warn(`[Mock Mode] Skipping document fetch for non-UUID application ID: ${applicationId}`);
        return {};
    }

    const { data: docs, error } = await supabase
        .from('documents')
        .select('*')
        .eq('application_id', applicationId);

    if (error) {
        console.error('Error fetching documents:', error);
        return {};
    }

    const docMap: Record<string, UploadedFile> = {};

    docs.forEach((doc: any) => {
        docMap[doc.slot_id] = {
            fileId: doc.id,
            fileName: doc.file_name,
            fileSize: doc.file_size || 0,
            uploadedAt: doc.updated_at,
            uploadedBy: 'User', // Placeholder
            status: doc.status as any,
            rejectionReason: doc.metadata?.rejectionReason
        };
    });

    return docMap;
};

/**
 * Deletes a document record by ID.
 */
export const deleteDocumentRecord = async (documentId: string) => {
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    if (error) throw error;
    return true;
};
