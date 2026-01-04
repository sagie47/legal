import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    evaluateApplication,
    regenerateSlots,
    type Evaluation,
    type Deadline,
    type Blocker,
    type Warning
} from '../services/evaluation';
import { getApplicationEvents, type CaseEvent } from '../services/caseEvents';
import { getSlotsWithDocuments, type SlotWithDocument } from '../services/documentFiles';

// ============================================================================
// UI TYPES (Matched to Documents.tsx expectations)
// ============================================================================

export interface DocumentSlotUI {
    id: string; // slot.id (UUID)
    label: string;
    group: string;
    required: boolean;
    role: 'applicant' | 'spouse' | 'employer' | 'child'; // Derived from scope?
    documentType: string; // Derived or hardcoded
    status: 'missing' | 'locked' | 'uploaded' | 'in_review' | 'verified' | 'rejected';
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    uploadedBy?: string;
    lockMessage?: string;
    rejectionReason?: string;
    expiryDate?: string;
    previewUrl?: string;
    mimeType?: string;
    slotDefinitionId: string; // Meta
}

export interface DocumentGroupUI {
    id: string;
    title: string;
    slots: DocumentSlotUI[];
}

// ============================================================================
// CONTEXT TYPE
// ============================================================================

interface EvaluationContextType {
    evaluation: Evaluation | null;
    isLoading: boolean;
    error: string | null;
    events: CaseEvent[];

    // Document Data
    slots: SlotWithDocument[];
    documentGroups: DocumentGroupUI[];

    // Actions
    refresh: () => Promise<void>;
    generateSlots: () => Promise<void>;

    // Convenience getters
    hasBlockers: boolean;
    hasCriticalDeadlines: boolean;
    isMaintainedStatusEligible: boolean;
    statusExpiryAt: string | null;
}

const EvaluationContext = createContext<EvaluationContextType | null>(null);

// ============================================================================
// PROVIDER
// ============================================================================

interface EvaluationProviderProps {
    applicationId: string;
    orgId: string;
    usesNewDocs?: boolean; // If false, skip slot/evaluation fetching (legacy system)
    children: ReactNode;
}

export const EvaluationProvider: React.FC<EvaluationProviderProps> = ({
    applicationId,
    orgId,
    usesNewDocs = false,
    children
}) => {
    const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
    const [events, setEvents] = useState<CaseEvent[]>([]);
    const [slots, setSlots] = useState<SlotWithDocument[]>([]);
    const [documentGroups, setDocumentGroups] = useState<DocumentGroupUI[]>([]);

    const [isLoading, setIsLoading] = useState(usesNewDocs); // Only load if using new docs
    const [error, setError] = useState<string | null>(null);

    // Map slots to UI groups
    const mapSlotsToGroups = useCallback((rawSlots: SlotWithDocument[]): DocumentGroupUI[] => {
        const groups: Record<string, DocumentGroupUI> = {};

        // Group by groupName
        rawSlots.forEach(slot => {
            const groupName = slot.groupName || 'Other Documents';
            const groupId = groupName.toLowerCase().replace(/\s+/g, '-');

            if (!groups[groupId]) {
                groups[groupId] = {
                    id: groupId,
                    title: groupName,
                    slots: []
                };
            }

            const isLocked = slot.state === 'locked';

            // Map to UI slot
            groups[groupId].slots.push({
                id: slot.slotId, // This is the instance ID (UUID)
                label: slot.label,
                group: groupId,
                required: slot.isRequired,
                role: 'applicant', // TODO: Map scope more dynamically if needed
                documentType: 'file', // Generic
                status: slot.state as any,
                fileId: slot.document?.id,
                fileName: slot.document?.fileName,
                fileSize: slot.document?.fileSize || undefined,
                uploadedAt: slot.document?.createdAt,
                uploadedBy: slot.document?.uploadedBy || undefined,
                previewUrl: slot.document?.id ? `https://bwclbjmbuthgpqvlysos.supabase.co/storage/v1/object/public/documents/${slot.document.storagePath}` : undefined,
                // NOTE: Using a direct public URL construction for MVP or signed URL logic should be injected.
                // For now, assuming public or that getSlotsWithDocuments will eventually return a signed URL.
                // Actually, getSlotsWithDocuments DOES NOT return signed URL yet.
                // We will rely on DocumentsAdapter to fetch signed URLs or the UI to handle it.
                // Let's leave previewUrl as undefined for now if we don't have it.

                mimeType: slot.document?.mimeType || undefined,
                slotDefinitionId: slot.slotDefinitionId
            });
        });

        // Convert Map to Array
        return Object.values(groups);
    }, []);

    // Load evaluation & data
    const loadData = useCallback(async () => {
        // Guard: Skip for legacy apps that don't use new docs system
        if (!usesNewDocs) {
            setIsLoading(false);
            return;
        }

        // Guard: Don't attempt load without applicationId
        if (!applicationId) {
            setIsLoading(false);
            setError('Missing application ID');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // 1. Evaluation - compute inline (no DB cache dependency)
            // We NEVER query application_evaluations directly - it's just a cache/history table.
            // Instead, always compute fresh evaluation which works even if cache table is empty.
            let evalData: Evaluation | null = null;
            try {
                // Compute evaluation inline - this doesn't require application_evaluations table
                evalData = await evaluateApplication(applicationId);
            } catch (evalErr) {
                // New tables may not exist yet - this is OK, just use defaults
                console.warn('Evaluation system not ready (tables may not exist):', evalErr);
                evalData = {
                    derived: {
                        statusExpiryAt: null,
                        recommendedApplyBy: null,
                        isMaintainedStatusEligible: false,
                        maintainedStatusConditions: 'NONE',
                        restorationRequired: false,
                        restorationDeadlineAt: null,
                    },
                    deadlines: [],
                    blockers: [],
                    warnings: [],
                    slotPlan: [],
                };
            }
            setEvaluation(evalData);

            // 2. Events (graceful fallback)
            try {
                const eventData = await getApplicationEvents(applicationId, { limit: 20 });
                setEvents(eventData);
            } catch {
                setEvents([]);
            }

            // 3. Slots (graceful fallback)
            try {
                const slotData = await getSlotsWithDocuments(applicationId);
                setSlots(slotData);
                setDocumentGroups(mapSlotsToGroups(slotData));
            } catch {
                setSlots([]);
                setDocumentGroups([]);
            }

        } catch (err) {
            console.error('Failed to load evaluation context:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [applicationId, usesNewDocs, mapSlotsToGroups]);

    // Refresh action
    const refresh = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const evalData = await evaluateApplication(applicationId);
            setEvaluation(evalData);

            const eventData = await getApplicationEvents(applicationId, { limit: 20 });
            setEvents(eventData);

            const slotData = await getSlotsWithDocuments(applicationId);
            setSlots(slotData);
            setDocumentGroups(mapSlotsToGroups(slotData));
        } catch (err) {
            console.error('Failed to refresh:', err);
            setError(err instanceof Error ? err.message : 'Failed to refresh');
        } finally {
            setIsLoading(false);
        }
    }, [applicationId, mapSlotsToGroups]);

    // Generate slots
    const generateSlots = useCallback(async () => {
        try {
            await regenerateSlots(applicationId, orgId);
            await refresh();
        } catch (err) {
            console.error('Failed to generate slots:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate slots');
        }
    }, [applicationId, orgId, refresh]);

    // Initial load
    useEffect(() => {
        loadData();
    }, [loadData]);

    // Derived values
    const hasBlockers = (evaluation?.blockers?.length ?? 0) > 0;
    const hasCriticalDeadlines = (evaluation?.deadlines?.some(d => d.severity === 'critical')) ?? false;
    const isMaintainedStatusEligible = evaluation?.derived?.isMaintainedStatusEligible ?? false;
    const statusExpiryAt = evaluation?.derived?.statusExpiryAt ?? null;

    return (
        <EvaluationContext.Provider value={{
            evaluation,
            isLoading,
            error,
            events,
            slots,
            documentGroups,
            refresh,
            generateSlots,
            hasBlockers,
            hasCriticalDeadlines,
            isMaintainedStatusEligible,
            statusExpiryAt,
        }}>
            {children}
        </EvaluationContext.Provider>
    );
};

// ============================================================================
// HOOK
// ============================================================================

export const useEvaluation = (): EvaluationContextType => {
    const context = useContext(EvaluationContext);
    if (!context) {
        throw new Error('useEvaluation must be used within an EvaluationProvider');
    }
    return context;
};

/**
 * Safe hook that returns null when outside EvaluationProvider (for optional usage)
 */
export const useEvaluationOptional = (): EvaluationContextType | null => {
    return useContext(EvaluationContext);
};

// ============================================================================
// RE-EXPORT TYPES
// ============================================================================

export type { Evaluation, Deadline, Blocker, Warning, CaseEvent };
