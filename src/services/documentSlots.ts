import { supabase } from '../lib/supabase';
import type { CaseFacts } from './caseFacts';

export type DocumentFileMeta = {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string | null;
    previewUrl?: string | null;
    uploadedAt: string;
    uploadedByUserId: string | null;
    status: 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected';
};

export type DocumentSlotResult = {
    id: string;
    groupId: string;
    label: string;
    role: 'applicant' | 'spouse' | 'child' | 'employer';
    documentType: string;
    required: boolean;
    visible: boolean;
    locked: boolean;
    lockMessage?: string | null;
    status: 'missing' | 'uploaded' | 'in_review' | 'verified' | 'rejected';
    documents: DocumentFileMeta[];
};

export type DocumentGroupResult = {
    id: string;
    title: string;
    slots: DocumentSlotResult[];
};

type DocumentSlotsResponse = {
    groups: DocumentGroupResult[];
    facts?: CaseFacts;
};

const getFunctionUrl = () => {
    const meta = import.meta as any;
    return (
        meta.env?.VITE_SUPABASE_FUNCTION_URL ||
        (meta.env?.VITE_SUPABASE_URL ? `${meta.env.VITE_SUPABASE_URL}/functions/v1` : null) ||
        'http://localhost:54321/functions/v1'
    );
};

export async function getDocumentSlotsForApplication(applicationId: string, orgId: string): Promise<DocumentSlotsResponse> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    if (!token) {
        throw new Error('Not authenticated');
    }

    const res = await fetch(
        `${getFunctionUrl()}/document-slots?applicationId=${encodeURIComponent(applicationId)}&orgId=${encodeURIComponent(orgId)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to fetch document slots');
    }

    return res.json();
}
