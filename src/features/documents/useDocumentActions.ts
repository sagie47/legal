import { useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useEvaluation } from '../../context/EvaluationContext';
import { createDocumentFile, attachFileToSlot, updateSlotState } from '../../services/documentFiles';
import { logSlotUploaded, logDocumentRemoved, logSlotVerified, logSlotRejected } from '../../services/caseEvents';
import { enqueueExtraction } from '../../services/extractions';
import { computeFileSha256 } from '../../utils/crypto';

export const useDocumentActions = () => {
    const { refresh } = useEvaluation();

    const uploadDocument = useCallback(async (
        slotId: string,
        file: File,
        metadata: {
            applicationId: string;
            orgId: string;
            usesNewDocs?: boolean;
            extractionProfile?: string | null;
            personId?: string | null;
        }
    ) => {
        try {
            const timestamp = Date.now();
            const storagePath = `${metadata.orgId}/${metadata.applicationId}/${slotId}/${timestamp}_${file.name}`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            const user = (await supabase.auth.getUser()).data.user;
            const uploadedBy = user?.id || 'system';

            const fileSha256 = await computeFileSha256(file);

            const documentFile = await createDocumentFile(
                metadata.orgId,
                storagePath,
                file.name,
                {
                    fileSize: file.size,
                    mimeType: file.type,
                    uploadedBy,
                    sha256: fileSha256 || undefined
                }
            );

            await attachFileToSlot(
                metadata.orgId,
                documentFile.id,
                slotId,
                { applicationId: metadata.applicationId }
            );

            await logSlotUploaded(
                metadata.orgId,
                metadata.applicationId,
                slotId,
                uploadedBy,
                file.name
            );

            // Enqueue OCR extraction if slot has extraction profile
            if (metadata.usesNewDocs && metadata.extractionProfile) {
                try {
                    await enqueueExtraction({
                        orgId: metadata.orgId,
                        applicationId: metadata.applicationId,
                        documentFileId: documentFile.id,
                        slotId,
                        profileKey: metadata.extractionProfile,
                        personId: metadata.personId,
                        fileSha256: documentFile.sha256,
                    });
                } catch (extractionError) {
                    // Don't fail the upload if extraction enqueue fails
                    console.error('Failed to enqueue extraction:', extractionError);
                }
            }

            await refresh();
            return documentFile;

        } catch (error) {
            console.error('Failed to upload document:', error);
            throw error;
        }
    }, [refresh]);

    const removeDocument = useCallback(async (slotId: string, metadata?: { applicationId?: string; orgId?: string }) => {
        try {
            const { data: link, error: linkError } = await supabase
                .from('document_links')
                .select('id, document_file_id, org_id, application_id')
                .eq('slot_id', slotId)
                .eq('is_active', true)
                .single();

            if (linkError || !link) {
                console.warn('No active document link found for slot:', slotId);
                return;
            }

            const { error: updateError } = await supabase
                .from('document_links')
                .update({ is_active: false, updated_at: new Date().toISOString() })
                .eq('id', link.id);

            if (updateError) throw updateError;

            await updateSlotState(slotId, 'missing');

            const user = (await supabase.auth.getUser()).data.user;
            if (metadata?.applicationId && metadata?.orgId) {
                await logDocumentRemoved(
                    metadata.orgId,
                    metadata.applicationId,
                    slotId,
                    user?.id || 'system'
                );
            }

            await refresh();

        } catch (error) {
            console.error('Failed to remove document:', error);
            throw error;
        }
    }, [refresh]);

    // ==========================================================================
    // REVIEW STATE TRANSITIONS
    // ==========================================================================

    /**
     * Mark a document as in_review (staff has started QA)
     */
    const markInReview = useCallback(async (slotId: string) => {
        try {
            await updateSlotState(slotId, 'in_review');
            await refresh();
        } catch (error) {
            console.error('Failed to mark in review:', error);
            throw error;
        }
    }, [refresh]);

    /**
     * Verify a document (staff confirms it meets requirements)
     */
    const verifyDocument = useCallback(async (
        slotId: string,
        metadata: { applicationId: string; orgId: string; slotDefinitionId?: string }
    ) => {
        try {
            await updateSlotState(slotId, 'verified');

            const user = (await supabase.auth.getUser()).data.user;
            await logSlotVerified(
                metadata.orgId,
                metadata.applicationId,
                metadata.slotDefinitionId || slotId,
                user?.id || 'system'
            );

            await refresh();
        } catch (error) {
            console.error('Failed to verify document:', error);
            throw error;
        }
    }, [refresh]);

    /**
     * Reject a document (staff determines it doesn't meet requirements)
     */
    const rejectDocument = useCallback(async (
        slotId: string,
        rejectionReason: string,
        metadata: { applicationId: string; orgId: string; slotDefinitionId?: string }
    ) => {
        try {
            await updateSlotState(slotId, 'rejected', { rejectionReason });

            const user = (await supabase.auth.getUser()).data.user;
            await logSlotRejected(
                metadata.orgId,
                metadata.applicationId,
                metadata.slotDefinitionId || slotId,
                rejectionReason,
                user?.id || 'system'
            );

            await refresh();
        } catch (error) {
            console.error('Failed to reject document:', error);
            throw error;
        }
    }, [refresh]);

    return {
        uploadDocument,
        removeDocument,
        markInReview,
        verifyDocument,
        rejectDocument,
    };
};
