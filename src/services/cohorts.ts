import { supabase } from '../lib/supabase';

export async function createCohort(orgId: string, employerId: string, data: { name: string; jobDetails: any }) {
    const { data: cohort, error } = await supabase
        .from('cohorts')
        .insert({
            org_id: orgId,
            employer_id: employerId,
            name: data.name,
            job_details: data.jobDetails,
            status: 'draft',
            risk_level: 'none',
        })
        .select()
        .single();

    if (error) throw error;
    return cohort;
}

export async function getCohorts(orgId: string) {
    const { data, error } = await supabase
        .from('cohorts')
        .select('*')
        .eq('org_id', orgId);

    if (error) throw error;
    return data || [];
}
