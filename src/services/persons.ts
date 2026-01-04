import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface PersonIdentity {
    familyName: string;
    givenNames: string;
    dob?: string;
    sex?: string;
    maritalStatus?: string;
}

export interface PersonPassport {
    number: string;
    country: string;
    issueDate?: string;
    expiryDate?: string;
}

export interface PersonContact {
    email?: string;
    phone?: string;
    address?: string;
}

export interface Person {
    id: string;
    orgId: string;
    identity: PersonIdentity | null;
    passport: PersonPassport | null;
    contact: PersonContact | null;
    createdAt: string;
    updatedAt: string;
}

export interface PersonStatus {
    id: string;
    orgId: string;
    personId: string;
    statusType: string;
    validFrom: string | null;
    validTo: string | null;
    conditions: Record<string, unknown> | null;
    permitNumber: string | null;
    isCurrent: boolean;
    meta: Record<string, unknown> | null;
}

// ============================================================================
// PERSON CRUD
// ============================================================================

export async function createPerson(
    orgId: string,
    identity: PersonIdentity,
    passport?: PersonPassport,
    contact?: PersonContact
): Promise<Person> {
    const { data, error } = await supabase
        .from('persons')
        .insert({
            org_id: orgId,
            identity,
            passport: passport || null,
            contact: contact || null,
        })
        .select()
        .single();

    if (error) throw error;
    return transformPerson(data);
}

export async function getPerson(personId: string): Promise<Person | null> {
    const { data, error } = await supabase
        .from('persons')
        .select('*')
        .eq('id', personId)
        .single();

    if (error || !data) return null;
    return transformPerson(data);
}

export async function updatePerson(
    personId: string,
    updates: {
        identity?: PersonIdentity;
        passport?: PersonPassport;
        contact?: PersonContact;
    }
): Promise<Person> {
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.identity) updateData.identity = updates.identity;
    if (updates.passport) updateData.passport = updates.passport;
    if (updates.contact) updateData.contact = updates.contact;

    const { data, error } = await supabase
        .from('persons')
        .update(updateData)
        .eq('id', personId)
        .select()
        .single();

    if (error) throw error;
    return transformPerson(data);
}

// ============================================================================
// PERSON STATUS MANAGEMENT
// ============================================================================

export async function addPersonStatus(
    orgId: string,
    personId: string,
    statusType: 'WORK_PERMIT' | 'STUDY_PERMIT' | 'VISITOR' | 'TRP' | 'PR',
    validFrom: string | null,
    validTo: string | null,
    options?: {
        conditions?: Record<string, unknown>;
        permitNumber?: string;
        makeCurrent?: boolean;
    }
): Promise<PersonStatus> {
    // If making current, first unset any existing current status
    if (options?.makeCurrent) {
        await supabase
            .from('person_statuses')
            .update({ is_current: false })
            .eq('person_id', personId)
            .eq('is_current', true);
    }

    const { data, error } = await supabase
        .from('person_statuses')
        .insert({
            org_id: orgId,
            person_id: personId,
            status_type: statusType,
            valid_from: validFrom,
            valid_to: validTo,
            conditions: options?.conditions || null,
            permit_number: options?.permitNumber || null,
            is_current: options?.makeCurrent ?? false,
        })
        .select()
        .single();

    if (error) throw error;
    return transformPersonStatus(data);
}

export async function getCurrentStatus(personId: string): Promise<PersonStatus | null> {
    const { data, error } = await supabase
        .from('person_statuses')
        .select('*')
        .eq('person_id', personId)
        .eq('is_current', true)
        .single();

    if (error || !data) return null;
    return transformPersonStatus(data);
}

export async function getStatusHistory(personId: string): Promise<PersonStatus[]> {
    const { data, error } = await supabase
        .from('person_statuses')
        .select('*')
        .eq('person_id', personId)
        .order('valid_to', { ascending: false });

    if (error || !data) return [];
    return data.map(transformPersonStatus);
}

// ============================================================================
// APPLICATION PARTICIPANTS
// ============================================================================

export async function linkPersonToApplication(
    orgId: string,
    applicationId: string,
    personId: string,
    role: 'PRINCIPAL' | 'SPOUSE' | 'CHILD' | 'SPONSOR' = 'PRINCIPAL'
): Promise<void> {
    const { error } = await supabase
        .from('application_participants')
        .upsert({
            org_id: orgId,
            application_id: applicationId,
            person_id: personId,
            role,
        }, {
            onConflict: 'application_id,person_id,role'
        });

    if (error) throw error;
}

export async function getApplicationParticipants(applicationId: string): Promise<{
    personId: string;
    role: string;
}[]> {
    const { data, error } = await supabase
        .from('application_participants')
        .select('person_id, role')
        .eq('application_id', applicationId);

    if (error || !data) return [];
    return data.map(p => ({
        personId: p.person_id,
        role: p.role
    }));
}

export async function getPrincipalPerson(applicationId: string): Promise<Person | null> {
    const { data, error } = await supabase
        .from('application_participants')
        .select('person_id')
        .eq('application_id', applicationId)
        .eq('role', 'PRINCIPAL')
        .single();

    if (error || !data) return null;
    return getPerson(data.person_id);
}

// ============================================================================
// MIGRATION HELPER: Create person from applicant
// ============================================================================

export async function createPersonFromApplicant(
    orgId: string,
    applicant: {
        identity?: PersonIdentity;
        passport?: PersonPassport;
    }
): Promise<Person> {
    return createPerson(
        orgId,
        applicant.identity || { familyName: 'Unknown', givenNames: 'Unknown' },
        applicant.passport
    );
}

// ============================================================================
// TRANSFORM HELPERS
// ============================================================================

function transformPerson(data: Record<string, unknown>): Person {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        identity: data.identity as PersonIdentity | null,
        passport: data.passport as PersonPassport | null,
        contact: data.contact as PersonContact | null,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
    };
}

function transformPersonStatus(data: Record<string, unknown>): PersonStatus {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        personId: data.person_id as string,
        statusType: data.status_type as string,
        validFrom: data.valid_from as string | null,
        validTo: data.valid_to as string | null,
        conditions: data.conditions as Record<string, unknown> | null,
        permitNumber: data.permit_number as string | null,
        isCurrent: data.is_current as boolean,
        meta: data.meta as Record<string, unknown> | null,
    };
}
