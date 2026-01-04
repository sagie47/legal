import { supabase } from '../lib/supabase';
import {
    CreateApplicantSchema,
    UpdateApplicantSchema,
    type CreateApplicantData,
    type UpdateApplicantData,
    type ApplicantHistory,
    type ApplicantFamily,
    type ApplicantMeta
} from '../lib/validators';

export type { ApplicantHistory, ApplicantFamily, ApplicantMeta, CreateApplicantData };

export async function createApplicant(orgId: string, data: CreateApplicantData) {
    // Validate data before sending to DB
    const validatedData = CreateApplicantSchema.parse(data);

    const { data: applicant, error } = await supabase
        .from('applicants')
        .insert({
            org_id: orgId,
            identity: validatedData.identity,
            passport: validatedData.passport,
            education: validatedData.education,
            employment: validatedData.employment,
            family: validatedData.family,
            history: validatedData.history,
            meta: validatedData.meta,
        })
        .select()
        .single();

    if (error) throw error;
    return applicant;
}

export async function updateApplicant(id: string, orgId: string, data: UpdateApplicantData) {
    // Validate partial data
    const validatedData = UpdateApplicantSchema.parse(data);

    const updates: any = {};
    if (validatedData.identity) updates.identity = validatedData.identity;
    if (validatedData.passport) updates.passport = validatedData.passport;
    if (validatedData.education) updates.education = validatedData.education;
    if (validatedData.employment) updates.employment = validatedData.employment;
    if (validatedData.family) updates.family = validatedData.family;
    if (validatedData.history) updates.history = validatedData.history;
    if (validatedData.meta) updates.meta = validatedData.meta;

    updates.updated_at = new Date().toISOString();

    const { data: applicant, error } = await supabase
        .from('applicants')
        .update(updates)
        .eq('id', id)
        .eq('org_id', orgId)
        .select()
        .single();

    if (error) throw error;
    return applicant;
}

export async function getApplicants(orgId: string) {
    const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .eq('org_id', orgId);

    if (error) throw error;
    return data || [];
}
