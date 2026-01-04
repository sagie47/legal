import { getDocumentSlotsForApplication } from './documentSlots';

export type CaseFacts = {
    orgId: string;
    applicationId: string;
    applicationType: string;
    applicant: {
        id: string;
        fullName: string;
        maritalStatus?: string;
        hasSpouse: boolean;
        hasChildren: boolean;
        uci?: string;
    };
    statusInCanada: {
        isInCanada: boolean;
        currentStatus?: string;
        originalEntryDate?: string;
    };
    family: {
        spouseExists: boolean;
        childrenCount: number;
    };
    residenceHistory: {
        countriesLast5Years: string[];
        countriesRequiringPoliceCert: string[];
    };
};

/**
 * Thin client wrapper that reuses the document-slots edge function response.
 * This keeps server-side Drizzle/Postgres code out of the browser bundle.
 */
export async function getCaseFacts(applicationId: string, orgId: string): Promise<CaseFacts> {
    const { facts } = await getDocumentSlotsForApplication(applicationId, orgId);
    if (!facts) {
        throw new Error('No facts returned from document-slots function');
    }
    return facts;
}
