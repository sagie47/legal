import { supabase } from '../lib/supabase';

export interface ApplicationDetails {
    // Study Permit details
    study?: {
        schoolName: string;
        schoolDli?: string;
        programLevel?: string;
        fieldOfStudy?: string;
        startDate?: string;
        endDate?: string;
        tuition?: number;
        financialSupport?: string;
    };
    // Work Permit details
    work?: {
        intendedOccupation?: string;
        employerName?: string;
        durationYears?: number;
        lmiaExemptionCode?: string;
    };
    travelHistory?: {
        country: string;
        purpose: string;
        fromDate: string;
        toDate: string;
    }[];
}

export async function createApplication(
    applicantId: string,
    cohortId: string | null | undefined,
    type: string,
    orgId: string,
    details?: ApplicationDetails
) {
    // 1. Fetch applicant
    const { data: applicant, error: applicantError } = await supabase
        .from('applicants')
        .select('*')
        .eq('id', applicantId)
        .eq('org_id', orgId)
        .single();

    if (applicantError) throw applicantError;
    if (!applicant) throw new Error('Applicant not found');

    // 2. Fetch cohort (optional)
    let cohort: any = null;
    if (cohortId) {
        const { data: cohortRow, error: cohortError } = await supabase
            .from('cohorts')
            .select('*')
            .eq('id', cohortId)
            .eq('org_id', orgId)
            .single();

        if (cohortError) throw cohortError;
        if (!cohortRow) throw new Error('Cohort not found');
        cohort = cohortRow;
    }

    // 3. Create Snapshots
    const applicantSnapshot = {
        identity: applicant.identity,
        passport: applicant.passport,
        education: applicant.education,
        employment: applicant.employment,
        family: applicant.family,
        history: applicant.history,
        meta: applicant.meta,
        capturedAt: new Date().toISOString(),
    };

    const jobSnapshot = cohort ? {
        name: cohort.name,
        jobDetails: cohort.job_details,
        employerId: cohort.employer_id,
        capturedAt: new Date().toISOString(),
    } : null;

    // 4. Insert Application
    const { data: application, error } = await supabase
        .from('applications')
        .insert({
            org_id: orgId,
            applicant_id: applicantId,
            cohort_id: cohortId || null,
            type,
            status: 'draft',
            applicant_snapshot: applicantSnapshot,
            job_snapshot: jobSnapshot,
            details: details || {},
        })
        .select()
        .single();

    if (error) throw error;
    return application;
}

// =============================================================================
// WORK PERMIT INSIDE CANADA - EXTEND
// =============================================================================

interface CreateWPExtendOptions {
    applicantId: string;
    orgId: string;
    cohortId?: string | null;
    actionIntent?: 'EXTEND' | 'CHANGE_EMPLOYER' | 'CHANGE_CONDITIONS' | 'RESTORE';
    programType?: 'TFWP' | 'IMP' | null;
    authorizationModel?: 'EMPLOYER_SPECIFIC' | 'OPEN' | null;
}

/**
 * Creates a Work Permit Inside Canada case with all typed dimensions set.
 * This ensures:
 * - applications.app_type = WORK_PERMIT
 * - applications.processing_context = INSIDE_CANADA
 * - applications.action_intent = EXTEND (or specified)
 * - applications.uses_new_docs = true
 * - work_permit_attributes row created
 * - principal person + participant link created
 */
export async function createWorkPermitExtendCase(options: CreateWPExtendOptions) {
    const {
        applicantId,
        orgId,
        cohortId = null,
        actionIntent = 'EXTEND',
        programType = null,
        authorizationModel = null,
    } = options;

    // 1. Fetch applicant for snapshot
    const { data: applicant, error: applicantError } = await supabase
        .from('applicants')
        .select('*')
        .eq('id', applicantId)
        .eq('org_id', orgId)
        .single();

    if (applicantError || !applicant) {
        throw new Error('Applicant not found');
    }

    // 2. Create applicant snapshot
    const applicantSnapshot = {
        identity: applicant.identity,
        passport: applicant.passport,
        education: applicant.education,
        employment: applicant.employment,
        family: applicant.family,
        history: applicant.history,
        meta: applicant.meta,
        capturedAt: new Date().toISOString(),
    };

    // 3. Create application with typed dimensions
    const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
            org_id: orgId,
            applicant_id: applicantId,
            cohort_id: cohortId,
            type: 'Work Permit Inside Canada',
            status: 'draft',
            applicant_snapshot: applicantSnapshot,
            job_snapshot: null,
            details: {},
            // TYPED DIMENSIONS
            app_type: 'WORK_PERMIT',
            processing_context: 'INSIDE_CANADA',
            action_intent: actionIntent,
            program_type: programType,
            authorization_model: authorizationModel,
            uses_new_docs: true,
        })
        .select()
        .single();

    if (appError) throw appError;

    // 4. Create person from applicant
    const { data: newPerson, error: personError } = await supabase
        .from('persons')
        .insert({
            org_id: orgId,
            identity: applicant.identity,
            passport: applicant.passport,
        })
        .select('id')
        .single();

    if (personError || !newPerson) throw personError || new Error('Failed to create person');
    const personId = newPerson.id;

    // 5. Create application_participant link (principal)
    await supabase
        .from('application_participants')
        .upsert({
            org_id: orgId,
            application_id: application.id,
            person_id: personId,
            role: 'PRINCIPAL',
        }, {
            onConflict: 'application_id,person_id,role',
        });

    // 6. Create work_permit_attributes row
    await supabase
        .from('work_permit_attributes')
        .insert({
            application_id: application.id,
            org_id: orgId,
            program_type: programType,
            authorization_model: authorizationModel,
            action_intent: actionIntent,
            inside_canada_context: {
                currentStatusType: null,
                currentStatusExpiresAt: null,
                lastEntryDate: null,
            },
        });

    return {
        ...application,
        personId,
    };
}

// =============================================================================
// QUERY FUNCTIONS
// =============================================================================

export async function getApplications(orgId?: string) {
    let query = supabase
        .from('applications')
        .select(`
            *,
            applicants (
                id,
                identity
            ),
            cohorts (
                id,
                name,
                job_details
            )
        `)
        .order('created_at', { ascending: false });

    if (orgId) {
        query = query.eq('org_id', orgId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

// =============================================================================
// STUDY PERMIT
// =============================================================================

interface CreateStudyPermitCaseOptions {
    applicantId: string;
    orgId: string;
    cohortId?: string | null;
    processingContext: 'INSIDE_CANADA' | 'OUTSIDE_CANADA';
    actionIntent?: 'APPLY' | 'EXTEND' | 'RESTORE';
}

/**
 * Creates a Study Permit case with typed dimensions and study_permit_attributes.
 */
export async function createStudyPermitCase(options: CreateStudyPermitCaseOptions) {
    const {
        applicantId,
        orgId,
        cohortId = null,
        processingContext,
        actionIntent,
    } = options;

    const { data: applicant, error: applicantError } = await supabase
        .from('applicants')
        .select('*')
        .eq('id', applicantId)
        .eq('org_id', orgId)
        .single();

    if (applicantError || !applicant) {
        throw new Error('Applicant not found');
    }

    const applicantSnapshot = {
        identity: applicant.identity,
        passport: applicant.passport,
        education: applicant.education,
        employment: applicant.employment,
        family: applicant.family,
        history: applicant.history,
        meta: applicant.meta,
        capturedAt: new Date().toISOString(),
    };

    const defaultAction = processingContext === 'OUTSIDE_CANADA' ? 'APPLY' : 'EXTEND';
    const effectiveActionIntent = actionIntent || defaultAction;
    const typeLabel = processingContext === 'OUTSIDE_CANADA'
        ? 'Study Permit Outside Canada'
        : 'Study Permit Inside Canada';

    const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
            org_id: orgId,
            applicant_id: applicantId,
            cohort_id: cohortId,
            type: typeLabel,
            status: 'draft',
            applicant_snapshot: applicantSnapshot,
            job_snapshot: null,
            details: {},
            app_type: 'STUDY_PERMIT',
            processing_context: processingContext,
            action_intent: effectiveActionIntent,
            uses_new_docs: true,
        })
        .select()
        .single();

    if (appError) throw appError;

    const { data: newPerson, error: personError } = await supabase
        .from('persons')
        .insert({
            org_id: orgId,
            identity: applicant.identity,
            passport: applicant.passport,
        })
        .select('id')
        .single();

    if (personError || !newPerson) throw personError || new Error('Failed to create person');
    const personId = newPerson.id;

    await supabase
        .from('application_participants')
        .upsert({
            org_id: orgId,
            application_id: application.id,
            person_id: personId,
            role: 'PRINCIPAL',
        }, {
            onConflict: 'application_id,person_id,role',
        });

    await supabase
        .from('study_permit_attributes')
        .insert({
            application_id: application.id,
            org_id: orgId,
            program: null,
            outside_canada_context: processingContext === 'OUTSIDE_CANADA' ? {
                countryOfResidence: null,
                countryOfCitizenship: null,
            } : null,
            inside_canada_context: processingContext === 'INSIDE_CANADA' ? {
                currentStatusType: 'STUDY_PERMIT',
                currentStatusExpiresAt: null,
                lastEntryDate: null,
            } : null,
            family_context: {
                hasAccompanyingSpouse: false,
                hasAccompanyingDependents: false,
            },
            pal_tal: {
                required: processingContext === 'OUTSIDE_CANADA',
                provinceOrTerritory: null,
                documentProvided: false,
            },
        });

    return {
        ...application,
        personId,
    };
}

export async function getApplicationById(applicationId: string, orgId: string) {
    const { data, error } = await supabase
        .from('applications')
        .select(`
            *,
            applicants (
                id,
                identity,
                passport,
                education,
                employment,
                family,
                history,
                meta
            ),
            cohorts (
                id,
                name,
                job_details
            )
        `)
        .eq('id', applicationId)
        .eq('org_id', orgId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
    }
    return data;
}

const isMissingTableError = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === '42P01') return true;
    return (error.message || '').toLowerCase().includes('does not exist');
};

export async function deleteApplication(applicationId: string, orgId: string) {
    const deleteByApp = async (table: string) => {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('application_id', applicationId)
            .eq('org_id', orgId);

        if (error && !isMissingTableError(error)) {
            throw error;
        }
    };

    await deleteByApp('fact_proposals');
    await deleteByApp('document_extractions');
    await deleteByApp('document_links');
    await deleteByApp('application_evaluations');
    await deleteByApp('case_events');
    await deleteByApp('slots');
    await deleteByApp('application_participants');
    await deleteByApp('work_permit_attributes');
    await deleteByApp('study_permit_attributes');
    await deleteByApp('documents');

    const { error: applicationError } = await supabase
        .from('applications')
        .delete()
        .eq('id', applicationId)
        .eq('org_id', orgId);

    if (applicationError && !isMissingTableError(applicationError)) {
        throw applicationError;
    }
}
