
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { DocumentGroup, type DocumentSlot } from '../features/documents';
import { evaluateDocuments } from '../lib/documentEvaluator';
import { WORK_PERMIT_IMM1295_CONFIG } from '../config/documentRules';
import { CaseData } from '../features/cases/CaseList';
import { supabase } from '../lib/supabase';
import { getDocumentSlotsForApplication, type DocumentFileMeta, type DocumentSlotResult } from '../services/documentSlots';
import { deleteDocumentRecord } from '../services/documents';

const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// 1. Define the Shape of the Data
export interface PersonalHistoryEntry {
    id: number;
    type: string;
    fromDate: string;
    toDate: string;
    organization: string;
    city: string;
    country: string;
    description: string;
}

export interface ResidenceEntry {
    id: number;
    country: string;
    status: string;
    fromDate: string;
    toDate: string;
}

export interface UploadedFile {
    fileId: string;
    fileName: string;
    fileSize: number;
    uploadedAt: string;
    uploadedBy: string;
    status: 'uploaded' | 'in_review' | 'verified' | 'rejected';
    rejectionReason?: string;
    previewUrl?: string;
    mimeType?: string;
}

export interface CaseFormData {
    // Documents State
    documents: Record<string, UploadedFile>;

    // Universal
    uci: string;
    gender: string;
    maritalStatus: string;

    // Address
    currentCountry: string;
    countryOfResidence: string;
    residenceStatus: string;
    residentialAddress: string;
    mailingSameAsResidential: boolean;
    mailingAddress: string;

    // IDs
    hasNationalId: boolean;
    nationalIdNumber: string;
    nationalIdCountry: string;
    nationalIdIssueDate: string;
    nationalIdExpiry: string;

    // Languages
    nativeLanguage: string;
    canCommunicateEnglish: boolean;
    canCommunicateFrench: boolean;
    languageTestTaken: boolean;
    languageTestType: string;
    languageTestScore: string;

    // Passport
    passportNum: string;
    passportCountry: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    isUSPassport: boolean;

    // Education
    eduLevel: string;
    eduSchool: string;
    eduCountry: string;
    eduFrom: string;
    eduTo: string;
    eduField: string;

    // Employment
    currentActivity: string;
    employerContact: string;
    jobTitle: string;
    employerName: string;
    jobCountry: string;
    jobCity: string;
    jobNoc: string;
    jobFrom: string;
    jobTo: string;
    jobDuties: string;

    // Family - Spouse
    spouseRelationType: string;
    spouseFamilyName: string;
    spouseGivenNames: string;
    spouseDob: string;
    spouseCountryOfBirth: string;
    spouseCitizenships: string;
    spouseCountryOfResidence: string;
    spouseAccompanying: boolean;
    dateOfRelationshipStart: string;
    placeOfMarriageCity: string;
    placeOfMarriageCountry: string;

    // Family - Child
    hasChildren: boolean;
    childFamilyName: string;
    childGivenNames: string;
    childDob: string;
    childCountryOfBirth: string;
    childCitizenships: string;
    childAccompanying: boolean;

    // Family - Parents (IMM 5707)
    motherFamilyName: string;
    motherGivenNames: string;
    motherDob: string;
    motherCountryOfBirth: string;
    fatherFamilyName: string;
    fatherGivenNames: string;
    fatherDob: string;
    fatherCountryOfBirth: string;

    // Immigration
    currentlyInCanada: boolean;
    dateOfEntry: string;
    originalEntryCity: string;
    originalEntryProvince: string;
    mostRecentEntryDate: string;
    mostRecentEntryCity: string;
    mostRecentEntryProvince: string;
    currentStatus: string;
    permitDocType: string;
    permitDocNumber: string;
    permitExpiryDate: string;

    // Background
    qTbContact: boolean;
    qTbContactExplanation: string;
    qMedicalNeeds: boolean;
    qMedicalNeedsExplanation: string;
    qStatusViolations: boolean;
    qStatusViolationsExplanation: string;
    qVisaRefusal: boolean;
    qVisaRefusalExplanation: string;
    qPreviousApplication: boolean;
    qPreviousApplicationDetails: string;
    qCriminalOffence: boolean;
    qCriminalOffenceExplanation: string;
    qMilitaryService: boolean;
    qMilitaryServiceDetails: string;
    qViolentOrgs: boolean;
    qViolentOrgsExplanation: string;
    qHrViolations: boolean;
    qHrViolationsExplanation: string;
    qGovPositions: boolean;
    qGovPositionsDetails: string;

    // Expanded Data Model (Arrays)
    personalHistory: PersonalHistoryEntry[];
    prevResidences: ResidenceEntry[];
}

export const INITIAL_FORM_DATA: CaseFormData = {
    documents: {},
    uci: '',
    gender: '',
    maritalStatus: '',
    currentCountry: 'Canada',
    countryOfResidence: 'Canada',
    residenceStatus: '',
    residentialAddress: '',
    mailingSameAsResidential: true,
    mailingAddress: '',
    hasNationalId: false,
    nationalIdNumber: '',
    nationalIdCountry: '',
    nationalIdIssueDate: '',
    nationalIdExpiry: '',
    nativeLanguage: '',
    canCommunicateEnglish: false,
    canCommunicateFrench: false,
    languageTestTaken: false,
    languageTestType: '',
    languageTestScore: '',
    passportNum: '',
    passportCountry: '',
    passportIssueDate: '',
    passportExpiryDate: '',
    isUSPassport: false,
    eduLevel: '',
    eduSchool: '',
    eduCountry: '',
    eduFrom: '',
    eduTo: '',
    eduField: '',
    currentActivity: '',
    employerContact: '',
    jobTitle: '',
    employerName: '',
    jobCountry: '',
    jobCity: '',
    jobNoc: '',
    jobFrom: '',
    jobTo: '',
    jobDuties: '',
    spouseRelationType: '',
    spouseFamilyName: '',
    spouseGivenNames: '',
    spouseDob: '',
    spouseCountryOfBirth: '',
    spouseCitizenships: '',
    spouseCountryOfResidence: '',
    spouseAccompanying: false,
    dateOfRelationshipStart: '',
    placeOfMarriageCity: '',
    placeOfMarriageCountry: '',
    hasChildren: false,
    childFamilyName: '',
    childGivenNames: '',
    childDob: '',
    childCountryOfBirth: '',
    childCitizenships: '',
    childAccompanying: false,
    motherFamilyName: '',
    motherGivenNames: '',
    motherDob: '',
    motherCountryOfBirth: '',
    fatherFamilyName: '',
    fatherGivenNames: '',
    fatherDob: '',
    fatherCountryOfBirth: '',
    currentlyInCanada: false,
    dateOfEntry: '',
    originalEntryCity: '',
    originalEntryProvince: '',
    mostRecentEntryDate: '',
    mostRecentEntryCity: '',
    mostRecentEntryProvince: '',
    currentStatus: '',
    permitDocType: '',
    permitDocNumber: '',
    permitExpiryDate: '',
    qTbContact: false,
    qTbContactExplanation: '',
    qMedicalNeeds: false,
    qMedicalNeedsExplanation: '',
    qStatusViolations: false,
    qStatusViolationsExplanation: '',
    qVisaRefusal: false,
    qVisaRefusalExplanation: '',
    qPreviousApplication: false,
    qPreviousApplicationDetails: '',
    qCriminalOffence: false,
    qCriminalOffenceExplanation: '',
    qMilitaryService: false,
    qMilitaryServiceDetails: '',
    qViolentOrgs: false,
    qViolentOrgsExplanation: '',
    qHrViolations: false,
    qHrViolationsExplanation: '',
    qGovPositions: false,
    qGovPositionsDetails: '',
    personalHistory: [{ id: 1, type: '', fromDate: '', toDate: '', organization: '', city: '', country: '', description: '' }],
    prevResidences: []
};


// 2. Define the Context Interface
interface CaseContextType {
    caseData: CaseData | null;
    formData: CaseFormData;
    updateFormData: (updates: Partial<CaseFormData>) => void;
    computedDocuments: DocumentGroup[];
    refreshDocuments: () => Promise<void>;
    saveDocument: (slotId: string, file: File) => Promise<void>;
    removeDocument: (slotId: string, fileId?: string) => Promise<void>;
    documentsLoading: boolean;

    // Specific array mutations (helpers)
    addHistoryEntry: () => void;
    removeHistoryEntry: (id: number) => void;
    updateHistoryEntry: (id: number, field: string, value: string) => void;
    addResidence: () => void;
    removeResidence: (id: number) => void;
    updateResidence: (id: number, field: string, value: string) => void;
}


const CaseContext = createContext<CaseContextType | undefined>(undefined);

// 3. Create the Provider
export const CaseProvider = ({ children, caseData }: { children: ReactNode; caseData: CaseData }) => {
    // In a real app, we'd initialize from DB or caseData here
    const [formData, setFormData] = useState<CaseFormData>(INITIAL_FORM_DATA);
    const [computedDocuments, setComputedDocuments] = useState<DocumentGroup[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);

    const effectiveOrgId =
        (caseData as any)?.raw?.org_id ||
        (caseData as any)?.raw?.orgId ||
        '';

    const updateComputedSlot = useCallback((slotId: string, updates: Partial<DocumentSlot>) => {
        setComputedDocuments(prev =>
            prev.map(group => ({
                ...group,
                slots: group.slots.map(slot => (slot.id === slotId ? { ...slot, ...updates } : slot))
            }))
        );
    }, []);

    const getMostRecentFile = (files: DocumentFileMeta[]): DocumentFileMeta | null => {
        if (!files?.length) return null;
        return [...files].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0] || null;
    };

    const mapSlotToUiSlot = (groupId: string, slot: DocumentSlotResult): DocumentSlot => {
        const latestFile = getMostRecentFile(slot.documents || []);
        const isLocked = !!slot.locked;

        return {
            id: slot.id,
            label: slot.label,
            group: groupId,
            required: slot.required,
            role: slot.role,
            documentType: slot.documentType,
            status: isLocked ? 'locked' : slot.status,
            lockMessage: isLocked ? (slot.lockMessage ?? undefined) : undefined,
            fileId: latestFile?.id,
            fileName: latestFile?.fileName,
            fileSize: latestFile?.fileSize,
            uploadedAt: latestFile?.uploadedAt,
            uploadedBy: latestFile?.uploadedByUserId ?? undefined,
            previewUrl: latestFile?.previewUrl ?? undefined,
            mimeType: latestFile?.mimeType ?? undefined
        };
    };

    const refreshDocuments = useCallback(async () => {
        if (!caseData?.id) return;

        const applicationId = String(caseData.id);
        const canUseRemote = isUuid(applicationId) && typeof effectiveOrgId === 'string' && effectiveOrgId.length > 0;

        if (!canUseRemote) return;

        setDocumentsLoading(true);
        try {
            const { groups } = await getDocumentSlotsForApplication(applicationId, effectiveOrgId);

            const mappedGroups: DocumentGroup[] = groups.map(group => ({
                id: group.id,
                title: group.title,
                slots: group.slots.map(slot => mapSlotToUiSlot(group.id, slot))
            }));

            setComputedDocuments(mappedGroups);

            const uploadedDocs: Record<string, UploadedFile> = {};
            for (const group of groups) {
                for (const slot of group.slots) {
                    const latestFile = getMostRecentFile(slot.documents || []);
                    if (!latestFile) continue;
                    uploadedDocs[slot.id] = {
                        fileId: latestFile.id,
                        fileName: latestFile.fileName,
                        fileSize: latestFile.fileSize,
                        uploadedAt: latestFile.uploadedAt,
                        uploadedBy: latestFile.uploadedByUserId || '',
                        status: (['uploaded', 'in_review', 'verified', 'rejected'] as const).includes(latestFile.status as any)
                            ? (latestFile.status as UploadedFile['status'])
                            : 'uploaded',
                        previewUrl: latestFile.previewUrl ?? undefined,
                        mimeType: latestFile.mimeType ?? undefined
                    };
                }
            }

            setFormData(prev => ({ ...prev, documents: uploadedDocs }));
        } catch (err) {
            console.error('Failed to refresh documents:', err);
        } finally {
            setDocumentsLoading(false);
        }
    }, [caseData?.id, effectiveOrgId]);

    useEffect(() => {
        void refreshDocuments();
    }, [refreshDocuments]);

    useEffect(() => {
        if (!caseData?.id) return;
        const applicationId = String(caseData.id);
        const canUseRemote = isUuid(applicationId) && typeof effectiveOrgId === 'string' && effectiveOrgId.length > 0;
        if (canUseRemote) return;
        setComputedDocuments(evaluateDocuments(formData, WORK_PERMIT_IMM1295_CONFIG));
    }, [caseData?.id, effectiveOrgId, formData]);

    const saveDocument = useCallback(async (slotId: string, file: File) => {
        if (!caseData?.id) return;

        // Ensure appId is a valid UUID
        const appId = String(caseData.id);
        const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appId);

        if (!isValidUuid) {
            console.error('Cannot upload document: Invalid application ID (not a UUID)');
            alert('Cannot upload document: Please select a real application from the database.');
            return;
        }

        // Optimistic UI Update
        setFormData(prev => ({
            ...prev,
            documents: {
                ...prev.documents,
                [slotId]: {
                    fileId: 'temp',
                    fileName: file.name,
                    fileSize: file.size,
                    uploadedAt: new Date().toLocaleString(),
                    uploadedBy: 'You',
                    status: 'uploaded'
                }
            }
        }));
        updateComputedSlot(slotId, {
            status: 'uploaded',
            fileId: 'temp',
            fileName: file.name,
            fileSize: file.size,
            uploadedAt: new Date().toISOString(),
            uploadedBy: 'You'
        });

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (sessionError || !token) {
                throw new Error('Not authenticated. Please log in to upload documents.');
            }

            const uploadFormData = new FormData();
            uploadFormData.append("applicationId", appId);
            uploadFormData.append("slotId", slotId);
            uploadFormData.append("file", file);

            // Use VITE_SUPABASE_FUNCTION_URL or fallback (Vite uses import.meta.env)
            const meta = import.meta as any;
            const functionUrl =
                meta.env?.VITE_SUPABASE_FUNCTION_URL ||
                (meta.env?.VITE_SUPABASE_URL ? `${meta.env.VITE_SUPABASE_URL}/functions/v1` : null) ||
                'http://localhost:54321/functions/v1';

            const res = await fetch(
                `${functionUrl}/upload-document`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: uploadFormData,
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Upload failed");
            }

            const slotPayload = await res.json();

            // Update with real data
            setFormData(prev => ({
                ...prev,
                documents: {
                    ...prev.documents,
                    [slotId]: {
                        ...prev.documents[slotId],
                        fileId: slotPayload.document.id,
                        status: slotPayload.status as any,
                        uploadedAt: slotPayload.document.uploadedAt || new Date().toISOString(),
                        fileName: slotPayload.document.fileName,
                        fileSize: slotPayload.document.size,
                        previewUrl: slotPayload.document.previewUrl,
                        mimeType: slotPayload.document.mimeType
                    }
                }
            }));

            updateComputedSlot(slotId, {
                status: slotPayload.status as any,
                fileId: slotPayload.document.id,
                fileName: slotPayload.document.fileName,
                fileSize: slotPayload.document.size,
                uploadedAt: slotPayload.document.uploadedAt || new Date().toISOString(),
                previewUrl: slotPayload.document.previewUrl || undefined,
                mimeType: slotPayload.document.mimeType || undefined
            });

            await refreshDocuments();

        } catch (err: any) {
            console.error('Document save failed:', err);
            // Revert state
            setFormData(prev => {
                const newDocs = { ...prev.documents };
                delete newDocs[slotId];
                return { ...prev, documents: newDocs };
            });
            await refreshDocuments();
            alert(`Failed to upload document: ${err.message || 'Unknown error'}`);
        }
    }, [caseData?.id, refreshDocuments, updateComputedSlot]);

    const removeDocument = useCallback(async (slotId: string, fileId?: string) => {
        // Optimistic local clear
        setFormData(prev => {
            const nextDocs = { ...prev.documents };
            delete nextDocs[slotId];
            return { ...prev, documents: nextDocs };
        });
        updateComputedSlot(slotId, {
            status: 'missing',
            fileId: undefined,
            fileName: undefined,
            fileSize: undefined,
            uploadedAt: undefined,
            uploadedBy: undefined,
            previewUrl: undefined,
            mimeType: undefined
        });

        try {
            if (fileId) {
                await deleteDocumentRecord(fileId);
            }
        } catch (err) {
            console.error('Failed to delete document record:', err);
        }

        await refreshDocuments();
    }, [refreshDocuments, updateComputedSlot]);

    const updateFormData = (updates: Partial<CaseFormData>) => {
        setFormData(prev => ({ ...prev, ...updates }));
    };

    // Helpers for arrays
    const addHistoryEntry = () => {
        setFormData(prev => ({
            ...prev,
            personalHistory: [...prev.personalHistory, { id: Date.now(), type: '', fromDate: '', toDate: '', organization: '', city: '', country: '', description: '' }]
        }));
    };

    const removeHistoryEntry = (id: number) => {
        setFormData(prev => {
            if (prev.personalHistory.length <= 1) return prev;
            return {
                ...prev,
                personalHistory: prev.personalHistory.filter(h => h.id !== id)
            };
        });
    };

    const updateHistoryEntry = (id: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            personalHistory: prev.personalHistory.map(h => h.id === id ? { ...h, [field]: value } : h)
        }));
    };

    const addResidence = () => {
        setFormData(prev => ({
            ...prev,
            prevResidences: [...prev.prevResidences, { id: Date.now(), country: '', status: '', fromDate: '', toDate: '' }]
        }));
    };

    const removeResidence = (id: number) => {
        setFormData(prev => ({
            ...prev,
            prevResidences: prev.prevResidences.filter(r => r.id !== id)
        }));
    };

    const updateResidence = (id: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            prevResidences: prev.prevResidences.map(r => r.id === id ? { ...r, [field]: value } : r)
        }));
    };

    return (
        <CaseContext.Provider value={{
            caseData,
            formData,
            updateFormData,
            computedDocuments,
            refreshDocuments,
            saveDocument,
            removeDocument,
            documentsLoading,
            addHistoryEntry,
            removeHistoryEntry,
            updateHistoryEntry,
            addResidence,
            removeResidence,
            updateResidence
        }}>
            {children}
        </CaseContext.Provider>
    );
};

// 4. Hook for consumers
export const useCase = () => {
    const context = useContext(CaseContext);
    if (context === undefined) {
        throw new Error('useCase must be used within a CaseProvider');
    }
    return context;
};
