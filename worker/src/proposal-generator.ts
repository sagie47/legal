/**
 * Proposal Generator
 * 
 * Creates fact_proposals rows from extraction results.
 * Handles supersession and noop detection.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ExtractionJob, ExtractionResult, ExtractedField } from './types';

// =============================================================================
// PROFILE → TARGET ENTITY MAPPING
// =============================================================================

const PROFILE_TARGET_ENTITY: Record<string, string> = {
    passport_v1: 'person',
    wp_current_permit_v1: 'person_status',
    sp_current_permit_v1: 'person_status',
    sp_loa_v1: 'study_permit_attributes',
};

const FIELD_KEY_TO_ENTITY: Record<string, string> = {
    'person.passport.number': 'person',
    'person.passport.country': 'person',
    'person.passport.expiryDate': 'person',
    'person.identity.familyName': 'person',
    'person.identity.givenNames': 'person',
    'person.identity.dob': 'person',
    'person.identity.sex': 'person',
    'person_status.validTo': 'person_status',
    'work_permit_attributes.insideCanadaContext.currentStatusExpiresAt': 'work_permit_attributes',
    'study_permit_attributes.insideCanadaContext.currentStatusExpiresAt': 'study_permit_attributes',
    'study_permit_attributes.program.dliNumber': 'study_permit_attributes',
    'study_permit_attributes.program.institutionName': 'study_permit_attributes',
    'study_permit_attributes.program.campusCity': 'study_permit_attributes',
    'study_permit_attributes.program.credentialLevel': 'study_permit_attributes',
    'study_permit_attributes.program.programName': 'study_permit_attributes',
    'study_permit_attributes.program.startDate': 'study_permit_attributes',
    'study_permit_attributes.program.endDate': 'study_permit_attributes',
    'study_permit_attributes.program.tuitionFirstYear': 'study_permit_attributes',
    'study_permit_attributes.program.deliveryMode': 'study_permit_attributes',
};

const FIELD_KEY_TO_SEVERITY: Record<string, string> = {
    'person.passport.number': 'high',
    'person.passport.expiryDate': 'high',
    'person.identity.dob': 'high',
    'person_status.validTo': 'high',
    'work_permit_attributes.insideCanadaContext.currentStatusExpiresAt': 'high',
    'study_permit_attributes.insideCanadaContext.currentStatusExpiresAt': 'high',
    'person.identity.familyName': 'high',
    'person.identity.givenNames': 'high',
    'person.passport.country': 'medium',
    'person.identity.sex': 'low',
    'study_permit_attributes.program.dliNumber': 'high',
    'study_permit_attributes.program.institutionName': 'high',
    'study_permit_attributes.program.programName': 'high',
    'study_permit_attributes.program.startDate': 'high',
    'study_permit_attributes.program.endDate': 'high',
    'study_permit_attributes.program.tuitionFirstYear': 'medium',
    'study_permit_attributes.program.campusCity': 'medium',
    'study_permit_attributes.program.credentialLevel': 'medium',
    'study_permit_attributes.program.deliveryMode': 'low',
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export async function generateProposals(
    supabase: SupabaseClient,
    job: ExtractionJob,
    result: ExtractionResult
): Promise<void> {
    const extractedFields = result.extractedFields;

    if (!extractedFields || Object.keys(extractedFields).length === 0) {
        console.log(`[${job.id}] No fields extracted, skipping proposal generation`);
        return;
    }

    console.log(`[${job.id}] Generating proposals for ${Object.keys(extractedFields).length} fields`);

    // Resolve target entity ID
    const targetEntityId = await resolveTargetEntityId(supabase, job);

    // Get current values for conflict detection
    const currentValues = await getCurrentValues(supabase, job, Object.keys(extractedFields));

    // Supersede any existing pending proposals from this slot
    await supersedePendingProposals(supabase, job);

    // Create new proposals
    const proposals = [];
    for (const [fieldKey, field] of Object.entries(extractedFields)) {
        const targetEntity = FIELD_KEY_TO_ENTITY[fieldKey] || PROFILE_TARGET_ENTITY[job.profile_key] || 'person';
        const severity = FIELD_KEY_TO_SEVERITY[fieldKey] || 'medium';

        // Get current value
        const currentValue = currentValues[fieldKey] ?? null;

        // Determine proposal status
        let status = 'pending';
        if (currentValue !== null && JSON.stringify(currentValue) === JSON.stringify(field.normalized)) {
            // Value already matches - noop
            status = 'noop';
        }

        // Parse field path from key
        const fieldPath = parseFieldPath(fieldKey);

        proposals.push({
            org_id: job.org_id,
            application_id: job.application_id,
            person_id: job.person_id,
            extraction_id: job.id,
            source_document_file_id: job.document_file_id,
            source_slot_id: job.slot_id,
            source_anchor: field.anchor,
            field_key: fieldKey,
            target_entity_type: targetEntity,
            target_entity_id: targetEntityId[targetEntity] || null,
            field_path: fieldPath,
            operation: 'set',
            proposed_value_json: field.normalized || field.value,
            current_value_json: currentValue,
            confidence: String(field.confidence.toFixed(2)),
            severity,
            status,
        });
    }

    if (proposals.length > 0) {
        const { error } = await supabase.from('fact_proposals').insert(proposals);
        if (error) {
            console.error(`[${job.id}] Failed to insert proposals:`, error);
            throw error;
        }
        console.log(`[${job.id}] Created ${proposals.length} proposals (${proposals.filter(p => p.status === 'noop').length} noop)`);
    }
}

// =============================================================================
// HELPERS
// =============================================================================

async function resolveTargetEntityId(
    supabase: SupabaseClient,
    job: ExtractionJob
): Promise<Record<string, string | null>> {
    const result: Record<string, string | null> = {};

    // Get person_id from job or from principal participant
    if (job.person_id) {
        result.person = job.person_id;
    } else {
        const { data: participant } = await supabase
            .from('application_participants')
            .select('person_id')
            .eq('application_id', job.application_id)
            .eq('role', 'PRINCIPAL')
            .maybeSingle();
        result.person = participant?.person_id || null;
    }

    // Get current person_status ID
    if (result.person) {
        const { data: status } = await supabase
            .from('person_statuses')
            .select('id')
            .eq('person_id', result.person)
            .eq('is_current', true)
            .maybeSingle();
        result.person_status = status?.id || null;
    }

    // work_permit_attributes uses application_id as target
    result.work_permit_attributes = job.application_id;
    // study_permit_attributes uses application_id as target
    result.study_permit_attributes = job.application_id;

    return result;
}

async function getCurrentValues(
    supabase: SupabaseClient,
    job: ExtractionJob,
    fieldKeys: string[]
): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    const targetIds = await resolveTargetEntityId(supabase, job);

    for (const fieldKey of fieldKeys) {
        try {
            const targetEntity = FIELD_KEY_TO_ENTITY[fieldKey] || 'person';
            const fieldPath = parseFieldPath(fieldKey);

            switch (targetEntity) {
                case 'person': {
                    if (!targetIds.person) break;
                    const [section, field] = fieldPath.split('.');
                    const { data } = await supabase
                        .from('persons')
                        .select(section)
                        .eq('id', targetIds.person)
                        .single();
                    result[fieldKey] = data?.[section]?.[field] ?? null;
                    break;
                }
                case 'person_status': {
                    if (!targetIds.person_status) break;
                    const { data } = await supabase
                        .from('person_statuses')
                        .select(fieldPath)
                        .eq('id', targetIds.person_status)
                        .single();
                    result[fieldKey] = data?.[fieldPath] ?? null;
                    break;
                }
                case 'work_permit_attributes': {
                    if (fieldPath.includes('.')) {
                        const [section, field] = fieldPath.split('.');
                        const { data } = await supabase
                            .from('work_permit_attributes')
                            .select(section)
                            .eq('application_id', job.application_id)
                            .single();
                        result[fieldKey] = data?.[section]?.[field] ?? null;
                    } else {
                        const { data } = await supabase
                            .from('work_permit_attributes')
                            .select(fieldPath)
                            .eq('application_id', job.application_id)
                            .single();
                        result[fieldKey] = data?.[fieldPath] ?? null;
                    }
                    break;
                }
                case 'study_permit_attributes': {
                    if (fieldPath.includes('.')) {
                        const [section, field] = fieldPath.split('.');
                        const { data } = await supabase
                            .from('study_permit_attributes')
                            .select(section)
                            .eq('application_id', job.application_id)
                            .single();
                        result[fieldKey] = data?.[section]?.[field] ?? null;
                    } else {
                        const { data } = await supabase
                            .from('study_permit_attributes')
                            .select(fieldPath)
                            .eq('application_id', job.application_id)
                            .single();
                        result[fieldKey] = data?.[fieldPath] ?? null;
                    }
                    break;
                }
            }
        } catch {
            result[fieldKey] = null;
        }
    }

    return result;
}

async function supersedePendingProposals(
    supabase: SupabaseClient,
    job: ExtractionJob
): Promise<void> {
    // Mark any pending proposals from the same slot as superseded
    const { error } = await supabase
        .from('fact_proposals')
        .update({
            status: 'superseded',
            updated_at: new Date().toISOString(),
        })
        .eq('source_slot_id', job.slot_id)
        .eq('status', 'pending')
        .neq('extraction_id', job.id);

    if (error) {
        console.warn(`[${job.id}] Failed to supersede old proposals:`, error);
    }
}

function parseFieldPath(fieldKey: string): string {
    // person.passport.expiryDate -> passport.expiryDate
    // person_status.validTo -> validTo
    // work_permit_attributes.insideCanadaContext.currentStatusExpiresAt -> insideCanadaContext.currentStatusExpiresAt
    // study_permit_attributes.program.startDate -> program.startDate
    const parts = fieldKey.split('.');
    if (parts[0] === 'person' || parts[0] === 'person_status' || parts[0] === 'work_permit_attributes' || parts[0] === 'study_permit_attributes') {
        return parts.slice(1).join('.');
    }
    return fieldKey;
}
