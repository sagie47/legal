import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface EvaluationDerived {
    statusExpiryAt: string | null;
    recommendedApplyBy: string | null;
    isMaintainedStatusEligible: boolean;
    maintainedStatusConditions: 'SAME_AS_CURRENT' | 'NONE';
    restorationRequired: boolean;
    restorationDeadlineAt: string | null;
}

export interface Deadline {
    key: string;
    dueAt: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
}

export interface Blocker {
    code: string;
    message: string;
    slotDefinitionId?: string;
    fieldKey?: string;
}

export interface Warning {
    code: string;
    message: string;
    slotDefinitionId?: string;
}

export interface SlotPlanItem {
    slotDefinitionId: string;
    scope: string;
    required: boolean;
    personId?: string;
}

export interface Evaluation {
    derived: EvaluationDerived;
    deadlines: Deadline[];
    blockers: Blocker[];
    warnings: Warning[];
    slotPlan: SlotPlanItem[];
}

export interface ApplicationWithDetails {
    id: string;
    orgId: string;
    appType: string | null;
    processingContext: string | null;
    actionIntent: string | null;
    programType: string | null;
    authorizationModel: string | null;
    subTypeCode: string | null;
    submittedAt: string | null;
    status: string;
}

export interface PersonStatus {
    statusType: string;
    validFrom: string | null;
    validTo: string | null;
    isCurrent: boolean;
}

export interface SlotInstance {
    id: string;
    slotDefinitionId: string;
    state: string;
    isRequired: boolean;
    meta?: Record<string, unknown> | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function today(): string {
    return new Date().toISOString().split('T')[0];
}

// ============================================================================
// MAIN EVALUATION FUNCTION
// ============================================================================

/**
 * Evaluates an application and returns blockers, warnings, deadlines, and derived flags.
 * This is the core rules engine that drives the UI.
 */
export async function evaluateApplication(appId: string): Promise<Evaluation> {
    // 1. Load application
    const { data: app, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', appId)
        .single();

    if (appError || !app) {
        throw new Error(`Application not found: ${appId}`);
    }

    const isWorkPermit = app.app_type === 'WORK_PERMIT';
    const isStudyPermit = app.app_type === 'STUDY_PERMIT';

    // 2. Load work permit attributes (if WP)
    let wpAttrs = null;
    if (isWorkPermit) {
        const { data } = await supabase
            .from('work_permit_attributes')
            .select('*')
            .eq('application_id', appId)
            .single();
        wpAttrs = data;
    }

    // 2b. Load study permit attributes (if SP)
    let spAttrs = null;
    if (isStudyPermit) {
        const { data } = await supabase
            .from('study_permit_attributes')
            .select('*')
            .eq('application_id', appId)
            .single();
        spAttrs = data;
    }

    // 3. Load principal participant and their current status
    const { data: participants } = await supabase
        .from('application_participants')
        .select('person_id, role')
        .eq('application_id', appId)
        .eq('role', 'PRINCIPAL');

    let currentStatus: PersonStatus | null = null;
    if (participants && participants.length > 0) {
        const { data: statuses } = await supabase
            .from('person_statuses')
            .select('*')
            .eq('person_id', participants[0].person_id)
            .eq('is_current', true)
            .single();
        if (statuses) {
            currentStatus = {
                statusType: statuses.status_type,
                validFrom: statuses.valid_from,
                validTo: statuses.valid_to,
                isCurrent: statuses.is_current,
            };
        }
    }

    // 4. Load slots for this application
    const { data: slots } = await supabase
        .from('slots')
        .select('id, slot_definition_id, state, is_required, meta')
        .eq('application_id', appId);

    // 5. Build evaluation
    const evaluation: Evaluation = {
        derived: {
            statusExpiryAt: null,
            recommendedApplyBy: null,
            isMaintainedStatusEligible: false,
            maintainedStatusConditions: 'NONE',
            restorationRequired: false,
            restorationDeadlineAt: null,
        },
        deadlines: [],
        blockers: [],
        warnings: [],
        slotPlan: [],
    };

    const fieldKeys = isWorkPermit ? {
        processingContext: 'workPermit.processingContext',
        actionIntent: 'workPermit.actionIntent',
        authorizationModel: 'workPermit.authorizationModel',
        programType: 'workPermit.programType',
        currentEmployerId: 'workPermit.currentEmployerId',
        statusExpiryAt: 'workPermit.insideCanadaContext.currentStatusExpiresAt',
        authorizationRefNumber: 'workPermit.authorizationArtifact.refNumber',
        openBasisCode: 'workPermit.openBasis.basisCode',
        outsideCountryFacts: 'workPermit.outsideCanadaContext',
    } : {
        processingContext: 'studyPermit.processingContext',
        actionIntent: 'studyPermit.actionIntent',
        statusExpiryAt: 'studyPermit.insideCanadaContext.currentStatusExpiresAt',
        outsideCountryFacts: 'studyPermit.outsideCanadaContext',
        programInstitution: 'studyPermit.program.institutionName',
        programStartDate: 'studyPermit.program.startDate',
        palTalRequired: 'studyPermit.palTal.required',
        palTalDocument: 'studyPermit.palTal.documentProvided',
    };

    const addMissingFact = (code: string, fieldKey: string, message: string) => {
        evaluation.blockers.push({
            code,
            message,
            fieldKey
        });
    };

    const effectiveActionIntentValue = isWorkPermit ? (wpAttrs?.action_intent ?? app.action_intent) : app.action_intent;
    const effectiveAuthorizationModel = isWorkPermit ? (wpAttrs?.authorization_model ?? app.authorization_model) : null;
    const effectiveProgramType = isWorkPermit ? (wpAttrs?.program_type ?? app.program_type) : null;

    if (!app.processing_context) {
        addMissingFact(
            'MISSING_FACT_PROCESSING_CONTEXT',
            fieldKeys.processingContext,
            'Processing context is required'
        );
    }

    if (!effectiveActionIntentValue) {
        addMissingFact(
            'MISSING_FACT_ACTION_INTENT',
            fieldKeys.actionIntent,
            'Action intent is required'
        );
    }

    if (isWorkPermit && !effectiveAuthorizationModel) {
        addMissingFact(
            'MISSING_FACT_AUTHORIZATION_MODEL',
            fieldKeys.authorizationModel,
            'Authorization model is required'
        );
    }
    if (isWorkPermit) {
        // ====================================================================
        // TEMPORAL LOGIC (Inside Canada Extend)
        // ====================================================================

        const effectiveActionIntent = effectiveActionIntentValue ||
            (app.processing_context === 'OUTSIDE_CANADA' ? 'APPLY' : 'EXTEND');
        const requiresStatusExpiry = app.processing_context === 'INSIDE_CANADA' &&
            ['EXTEND', 'RESTORE', 'CHANGE_EMPLOYER'].includes(effectiveActionIntent);

        if (requiresStatusExpiry) {
            // Get status expiry (inside Canada context first, then person status)
            const statusExpiryAt = wpAttrs?.inside_canada_context?.currentStatusExpiresAt ||
                currentStatus?.validTo ||
                null;

            if (!statusExpiryAt) {
                addMissingFact(
                    'MISSING_FACT_CURRENT_STATUS_EXPIRES_AT',
                    fieldKeys.statusExpiryAt,
                    'Current status expiry date is required for inside Canada applications'
                );
            } else {
                evaluation.derived.statusExpiryAt = statusExpiryAt;
                evaluation.derived.recommendedApplyBy = addDays(statusExpiryAt, -30);

                // Check maintained status eligibility
                if (app.submitted_at) {
                    const submittedDate = app.submitted_at.split('T')[0];
                    if (submittedDate <= statusExpiryAt) {
                        evaluation.derived.isMaintainedStatusEligible = true;
                        evaluation.derived.maintainedStatusConditions = 'SAME_AS_CURRENT';
                    } else {
                        evaluation.derived.restorationRequired = true;
                        // Restoration window is typically 90 days after expiry
                        evaluation.derived.restorationDeadlineAt = addDays(statusExpiryAt, 90);
                    }
                } else {
                    // Not submitted yet - check deadlines
                    const daysUntilExpiry = daysBetween(today(), statusExpiryAt);

                    if (daysUntilExpiry <= 30 && daysUntilExpiry > 14) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_info',
                            dueAt: statusExpiryAt,
                            severity: 'info',
                            message: `Status expires in ${daysUntilExpiry} days. Consider submitting soon.`
                        });
                    } else if (daysUntilExpiry <= 14 && daysUntilExpiry > 7) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_warning',
                            dueAt: statusExpiryAt,
                            severity: 'warning',
                            message: `Status expires in ${daysUntilExpiry} days. Submit soon to maintain status.`
                        });
                    } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_critical',
                            dueAt: statusExpiryAt,
                            severity: 'critical',
                            message: `Status expires in ${daysUntilExpiry} days! Submit immediately.`
                        });
                    } else if (daysUntilExpiry <= 0) {
                        evaluation.warnings.push({
                            code: 'STATUS_EXPIRED',
                            message: 'Status has expired. Restoration may be required.'
                        });
                        evaluation.derived.restorationRequired = true;
                        evaluation.derived.restorationDeadlineAt = addDays(statusExpiryAt, 90);
                    }
                }
            }
        }

        // ====================================================================
        // REQUIRED FACTS (Avoid treating data fields as missing documents)
        // ====================================================================

        if (effectiveAuthorizationModel === 'EMPLOYER_SPECIFIC') {
            if (!wpAttrs?.current_employer_id) {
                addMissingFact(
                    'MISSING_FACT_CURRENT_EMPLOYER',
                    fieldKeys.currentEmployerId,
                    'Current employer is required for employer-specific work permits'
                );
            }

            if (!effectiveProgramType) {
                addMissingFact(
                    'MISSING_FACT_PROGRAM_TYPE',
                    fieldKeys.programType,
                    'Program type is required for employer-specific work permits'
                );
            }

            if (effectiveProgramType === 'IMP' && !wpAttrs?.authorization_artifact?.refNumber) {
                addMissingFact(
                    'MISSING_FACT_IMP_OFFER_NUMBER',
                    fieldKeys.authorizationRefNumber,
                    'Offer of Employment number is required for employer-specific IMP cases'
                );
            }

            if (effectiveProgramType === 'TFWP' && !wpAttrs?.authorization_artifact?.refNumber) {
                addMissingFact(
                    'MISSING_FACT_LMIA_REF',
                    fieldKeys.authorizationRefNumber,
                    'LMIA number is required for employer-specific TFWP cases'
                );
            }
        }

        if (effectiveAuthorizationModel === 'OPEN') {
            const basisCode = wpAttrs?.open_basis?.basisCode;
            if (!basisCode) {
                addMissingFact(
                    'MISSING_FACT_OPEN_BASIS',
                    fieldKeys.openBasisCode,
                    'Open work permit basis is required'
                );
            }
        }

        if (app.processing_context === 'OUTSIDE_CANADA') {
            const outside = wpAttrs?.outside_canada_context || {};
            const residence = typeof outside.countryOfResidence === 'string' ? outside.countryOfResidence.trim() : '';
            const citizenship = typeof outside.countryOfCitizenship === 'string' ? outside.countryOfCitizenship.trim() : '';

            if (!residence || !citizenship) {
                addMissingFact(
                    'MISSING_FACT_OUTSIDE_COUNTRY_FACTS',
                    fieldKeys.outsideCountryFacts,
                    'Country of residence and citizenship are required'
                );
            }
        }
    } else if (isStudyPermit) {
        const effectiveActionIntent = effectiveActionIntentValue ||
            (app.processing_context === 'OUTSIDE_CANADA' ? 'APPLY' : 'EXTEND');
        const requiresStatusExpiry = app.processing_context === 'INSIDE_CANADA' &&
            ['EXTEND', 'RESTORE'].includes(effectiveActionIntent);

        if (requiresStatusExpiry) {
            const statusExpiryAt = spAttrs?.inside_canada_context?.currentStatusExpiresAt ||
                currentStatus?.validTo ||
                null;

            if (!statusExpiryAt) {
                addMissingFact(
                    'MISSING_FACT_CURRENT_STATUS_EXPIRES_AT',
                    fieldKeys.statusExpiryAt,
                    'Current status expiry date is required for inside Canada applications'
                );
            } else {
                evaluation.derived.statusExpiryAt = statusExpiryAt;
                evaluation.derived.recommendedApplyBy = addDays(statusExpiryAt, -30);

                if (app.submitted_at) {
                    const submittedDate = app.submitted_at.split('T')[0];
                    if (submittedDate <= statusExpiryAt) {
                        evaluation.derived.isMaintainedStatusEligible = true;
                        evaluation.derived.maintainedStatusConditions = 'SAME_AS_CURRENT';
                    } else {
                        evaluation.derived.restorationRequired = true;
                        evaluation.derived.restorationDeadlineAt = addDays(statusExpiryAt, 90);
                    }
                } else {
                    const daysUntilExpiry = daysBetween(today(), statusExpiryAt);

                    if (daysUntilExpiry <= 30 && daysUntilExpiry > 14) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_info',
                            dueAt: statusExpiryAt,
                            severity: 'info',
                            message: `Status expires in ${daysUntilExpiry} days. Consider submitting soon.`
                        });
                    } else if (daysUntilExpiry <= 14 && daysUntilExpiry > 7) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_warning',
                            dueAt: statusExpiryAt,
                            severity: 'warning',
                            message: `Status expires in ${daysUntilExpiry} days. Submit soon to maintain status.`
                        });
                    } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
                        evaluation.deadlines.push({
                            key: 'status_expiry_critical',
                            dueAt: statusExpiryAt,
                            severity: 'critical',
                            message: `Status expires in ${daysUntilExpiry} days! Submit immediately.`
                        });
                    } else if (daysUntilExpiry <= 0) {
                        evaluation.warnings.push({
                            code: 'STATUS_EXPIRED',
                            message: 'Status has expired. Restoration may be required.'
                        });
                        evaluation.derived.restorationRequired = true;
                        evaluation.derived.restorationDeadlineAt = addDays(statusExpiryAt, 90);
                    }
                }
            }
        }

        const isOutsideApply = app.processing_context === 'OUTSIDE_CANADA' && effectiveActionIntent === 'APPLY';
        if (isOutsideApply) {
            const program = spAttrs?.program || {};
            const hasInstitution = Boolean(
                (typeof program.institutionName === 'string' && program.institutionName.trim().length > 0) ||
                (typeof program.dliNumber === 'string' && program.dliNumber.trim().length > 0)
            );
            if (!hasInstitution) {
                addMissingFact(
                    'MISSING_FACT_PROGRAM_INSTITUTION',
                    fieldKeys.programInstitution,
                    'Institution name or DLI number is required'
                );
            }

            const hasStartDate = typeof program.startDate === 'string' && program.startDate.trim().length > 0;
            if (!hasStartDate) {
                addMissingFact(
                    'MISSING_FACT_PROGRAM_START_DATE',
                    fieldKeys.programStartDate,
                    'Program start date is required'
                );
            }

            const outside = spAttrs?.outside_canada_context || {};
            const residence = typeof outside.countryOfResidence === 'string' ? outside.countryOfResidence.trim() : '';
            const citizenship = typeof outside.countryOfCitizenship === 'string' ? outside.countryOfCitizenship.trim() : '';

            if (!residence || !citizenship) {
                addMissingFact(
                    'MISSING_FACT_OUTSIDE_COUNTRY_FACTS',
                    fieldKeys.outsideCountryFacts,
                    'Country of residence and citizenship are required'
                );
            }

            const palRequired = spAttrs?.pal_tal?.required;
            if (typeof palRequired !== 'boolean') {
                addMissingFact(
                    'MISSING_FACT_PAL_TAL_REQUIRED',
                    fieldKeys.palTalRequired,
                    'PAL/TAL requirement must be set'
                );
            }

            if (palRequired === true) {
                const palSlot = slots?.find(slot => slot.slot_definition_id === 'sp.pal_tal');
                if (!palSlot) {
                    evaluation.blockers.push({
                        code: 'MISSING_DOC_PAL_TAL',
                        message: 'PAL/TAL document is required',
                        fieldKey: fieldKeys.palTalDocument
                    });
                } else if (!palSlot.is_required && (palSlot.state === 'missing' || palSlot.state === 'rejected')) {
                    evaluation.blockers.push({
                        code: palSlot.state === 'rejected' ? 'REJECTED_DOC_PAL_TAL' : 'MISSING_DOC_PAL_TAL',
                        message: 'PAL/TAL document is required',
                        slotDefinitionId: palSlot.slot_definition_id,
                        fieldKey: fieldKeys.palTalDocument
                    });
                }
            }
        }
    }

    // ========================================================================
    // SLOT VALIDATION
    // ========================================================================

    if (slots) {
        for (const slot of slots) {
            const isWaived = Boolean((slot.meta as Record<string, unknown> | null)?.waivedAt);
            if (isWaived) {
                continue;
            }
            if (slot.is_required && slot.state === 'missing') {
                evaluation.blockers.push({
                    code: 'MISSING_REQUIRED_DOC',
                    message: `Missing required document: ${slot.slot_definition_id}`,
                    slotDefinitionId: slot.slot_definition_id
                });
            }

            if (slot.is_required && slot.state === 'rejected') {
                evaluation.blockers.push({
                    code: 'REJECTED_REQUIRED_DOC',
                    message: `Document rejected: ${slot.slot_definition_id}`,
                    slotDefinitionId: slot.slot_definition_id
                });
            }

            evaluation.slotPlan.push({
                slotDefinitionId: slot.slot_definition_id,
                scope: 'PRINCIPAL', // TODO: get from definition
                required: slot.is_required
            });
        }
    }

    return evaluation;
}

// ============================================================================
// SLOT GENERATION
// ============================================================================

/**
 * Generates slot instances for an application based on its dimensions.
 * Idempotent - will not duplicate existing slots.
 */
export async function regenerateSlots(appId: string, orgId: string): Promise<void> {
    // 1. Load application dimensions
    const { data: app, error } = await supabase
        .from('applications')
        .select('app_type, processing_context, action_intent, program_type, authorization_model, sub_type_code')
        .eq('id', appId)
        .single();

    if (error || !app) {
        throw new Error(`Application not found: ${appId}`);
    }

    if (!app.app_type) {
        throw new Error('Application type must be set before generating slots');
    }

    // 2. Query matching slot definitions
    let query = supabase
        .from('slot_definitions')
        .select('*')
        .eq('app_type', app.app_type);

    // Apply optional dimension filters (NULL in definition = wildcard)
    if (app.processing_context) {
        query = query.or(`processing_context.is.null,processing_context.eq.${app.processing_context}`);
    }
    if (app.action_intent) {
        query = query.or(`action_intent.is.null,action_intent.eq.${app.action_intent}`);
    }
    if (app.program_type) {
        query = query.or(`program_type.is.null,program_type.eq.${app.program_type}`);
    }
    if (app.authorization_model) {
        query = query.or(`authorization_model.is.null,authorization_model.eq.${app.authorization_model}`);
    }

    const { data: definitions } = await query.order('display_order');

    if (!definitions || definitions.length === 0) {
        console.log('No slot definitions found for application dimensions');
        return;
    }

    // 3. Create slot instances (upsert to be idempotent)
    for (const def of definitions) {
        const { error: upsertError } = await supabase
            .from('slots')
            .upsert({
                org_id: orgId,
                application_id: appId,
                person_id: null, // TODO: Get principal person ID for scoped slots
                slot_definition_id: def.id,
                state: 'missing',
                is_required: def.is_required,
            }, {
                onConflict: 'org_id,application_id,person_id,slot_definition_id',
                ignoreDuplicates: true
            });

        if (upsertError) {
            console.error(`Failed to create slot ${def.id}:`, upsertError);
        }
    }
}

// ============================================================================
// PERSIST EVALUATION
// ============================================================================

/**
 * Runs evaluation and persists the result for fast UI rendering.
 */
export async function evaluateAndPersist(appId: string, orgId: string): Promise<Evaluation> {
    const evaluation = await evaluateApplication(appId);

    await supabase
        .from('application_evaluations')
        .insert({
            org_id: orgId,
            application_id: appId,
            derived: evaluation.derived,
            deadlines: evaluation.deadlines,
            blockers: evaluation.blockers,
            warnings: evaluation.warnings,
            slot_plan: evaluation.slotPlan,
        });

    return evaluation;
}

// ============================================================================
// GET LATEST EVALUATION
// ============================================================================

export async function getLatestEvaluation(appId: string): Promise<Evaluation | null> {
    const { data, error } = await supabase
        .from('application_evaluations')
        .select('*')
        .eq('application_id', appId)
        .order('evaluated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return {
        derived: data.derived as EvaluationDerived,
        deadlines: data.deadlines as Deadline[],
        blockers: data.blockers as Blocker[],
        warnings: data.warnings as Warning[],
        slotPlan: data.slot_plan as SlotPlanItem[],
    };
}
