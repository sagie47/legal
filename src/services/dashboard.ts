import { supabase } from '../lib/supabase';

export async function getDashboardStats(orgId: string) {
    // Basic mock aggregates using real counts where possible
    // Implementing full SQL aggregates via Supabase JS is tricky without Views/RPC
    // For MVP, we'll fetch counts or just return 0 if complicated

    const { count: activeLmiasCount } = await supabase
        .from('cohorts')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'ready', 'submitted'])
        .eq('org_id', orgId);

    const { count: pendingWps } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'generated'])
        .eq('org_id', orgId);

    // Mock the rest for now to ensure UI renders
    return {
        activeLmiasCount: activeLmiasCount || 0,
        lmiasDeltaWeek: 0,
        pendingWorkPermitsCount: pendingWps || 0,
        pendingWpAvgWaitDays: 0,
        expiringSoonCount: 0,
        placedYtdCount: 0,
        placedYtdDeltaPercent: 0,
    };
}

export async function getActiveCohorts(orgId: string) {
    const { data, error } = await supabase
        .from('cohorts')
        .select('*')
        .neq('status', 'closed')
        .eq('org_id', orgId);

    if (error) throw error;

    // Need to map snake_case from DB to camelCase if UI expects it?
    // Our Drizzle schema used camelCase in TS but DB columns are snake_case.
    // The UI currently expects: `name`, `workers` (string), `lmia` (status), `risk`, `next`.
    // We need to transform the data to match UI expectations.

    return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        locationCity: c.job_details?.locationCity,
        locationProvince: c.job_details?.locationProvince,
        workersCurrent: 0, // TODO: fetch actual count
        jobDetails: c.job_details,
        workers: `0/${c.job_details?.targetWorkers || 0}`,
        status: c.status,
        lmia: capitalize(c.status), // map status to UI label
        riskLevel: c.risk_level,
        wp: 'Not Started', // placeholder
        next: 'View Details'
    }));
}

export async function getComplianceAlerts(orgId: string) {
    const { data, error } = await supabase
        .from('compliance_alerts')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_resolved', false)
        .limit(5);

    if (error) throw error;
    return data || [];
}

function capitalize(s: string) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}
