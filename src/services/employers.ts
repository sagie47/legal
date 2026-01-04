import { supabase } from '../lib/supabase';

export async function createEmployer(orgId: string, data: {
    companyName: string;
    businessNumber?: string;
    address?: { city?: string; province?: string; country?: string };
}) {
    const { data: employer, error } = await supabase
        .from('employers')
        .insert({
            org_id: orgId,
            company_name: data.companyName,
            business_number: data.businessNumber,
            address: data.address,
        })
        .select()
        .single();

    if (error) throw error;
    return employer;
}

export async function getEmployers(orgId: string) {
    const { data, error } = await supabase
        .from('employers')
        .select('*')
        .eq('org_id', orgId);

    if (error) throw error;
    return data || [];
}
