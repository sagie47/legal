/**
 * Shared Evaluation Logic for Study Permit flows.
 */

import type { Evaluation, Blocker, Warning, Deadline } from "./spContracts.ts";

// =============================================================================
// HELPERS
// =============================================================================

export const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
};

export const today = (): string => new Date().toISOString().split("T")[0];

export const daysBetween = (date1: string, date2: string): number => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
};

// =============================================================================
// SLOT ROW TYPE
// =============================================================================

export interface SlotRow {
    id: string;
    slot_definition_id: string;
    state: string;
    is_required: boolean;
    meta?: Record<string, unknown> | null;
    slot_definitions: {
        label: string;
        group_name: string | null;
        help_text: string | null;
        scope: string;
    } | null;
}

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

export interface EvaluationInput {
    statusExpiryAt: string | null;
    submittedAt: string | null;
    processingContext: string | null;
    actionIntent: string | null;
    program: {
        dliNumber?: string;
        institutionName?: string;
        startDate?: string;
    } | null;
    outsideCanadaContext: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
    } | null;
    insideCanadaContext: {
        currentStatusType?: string;
        currentStatusExpiresAt?: string;
        lastEntryDate?: string;
    } | null;
    palTal: {
        required?: boolean;
        documentProvided?: boolean;
    } | null;
    slots: SlotRow[];
}

export function evaluateStudyFromData(input: EvaluationInput): Evaluation {
    const {
        statusExpiryAt,
        submittedAt,
        processingContext,
        actionIntent,
        program,
        outsideCanadaContext,
        palTal,
        slots,
    } = input;
    const blockers: Blocker[] = [];
    const warnings: Warning[] = [];
    const deadlines: Deadline[] = [];

    const isInsideCanada = processingContext === "INSIDE_CANADA";
    const isOutsideCanada = processingContext === "OUTSIDE_CANADA";
    const effectiveActionIntent = actionIntent ||
        (processingContext === "OUTSIDE_CANADA" ? "APPLY" : "EXTEND");
    const isOutsideApply = isOutsideCanada && effectiveActionIntent === "APPLY";

    const fieldKeys = {
        processingContext: "studyPermit.processingContext",
        actionIntent: "studyPermit.actionIntent",
        statusExpiryAt: "studyPermit.insideCanadaContext.currentStatusExpiresAt",
        outsideCountryFacts: "studyPermit.outsideCanadaContext",
        programInstitution: "studyPermit.program.institutionName",
        programStartDate: "studyPermit.program.startDate",
        palTalRequired: "studyPermit.palTal.required",
        palTalDocument: "studyPermit.palTal.documentProvided",
    };

    const addMissingFact = (code: string, fieldKey: string, message: string) => {
        blockers.push({
            code,
            message,
            fieldKey,
        });
    };

    if (!processingContext) {
        addMissingFact(
            "MISSING_FACT_PROCESSING_CONTEXT",
            fieldKeys.processingContext,
            "Processing context is required"
        );
    }

    if (!actionIntent) {
        addMissingFact(
            "MISSING_FACT_ACTION_INTENT",
            fieldKeys.actionIntent,
            "Action intent is required"
        );
    }

    const requiresStatusExpiry = isInsideCanada &&
        ["EXTEND", "RESTORE"].includes(effectiveActionIntent);
    if (requiresStatusExpiry && !statusExpiryAt) {
        addMissingFact(
            "MISSING_FACT_CURRENT_STATUS_EXPIRES_AT",
            fieldKeys.statusExpiryAt,
            "Current status expiry date is required for inside Canada applications"
        );
    }

    if (isOutsideApply) {
        const hasInstitution = Boolean(
            (program?.institutionName && program.institutionName.trim().length > 0) ||
            (program?.dliNumber && program.dliNumber.trim().length > 0)
        );
        if (!hasInstitution) {
            addMissingFact(
                "MISSING_FACT_PROGRAM_INSTITUTION",
                fieldKeys.programInstitution,
                "Institution name or DLI number is required"
            );
        }

        const hasStartDate = Boolean(program?.startDate && program.startDate.trim().length > 0);
        if (!hasStartDate) {
            addMissingFact(
                "MISSING_FACT_PROGRAM_START_DATE",
                fieldKeys.programStartDate,
                "Program start date is required"
            );
        }

        const residence = typeof outsideCanadaContext?.countryOfResidence === "string"
            ? outsideCanadaContext.countryOfResidence.trim()
            : "";
        const citizenship = typeof outsideCanadaContext?.countryOfCitizenship === "string"
            ? outsideCanadaContext.countryOfCitizenship.trim()
            : "";

        if (!residence || !citizenship) {
            addMissingFact(
                "MISSING_FACT_OUTSIDE_COUNTRY_FACTS",
                fieldKeys.outsideCountryFacts,
                "Country of residence and citizenship are required"
            );
        }

        const palRequiredKnown = typeof palTal?.required === "boolean";
        if (!palRequiredKnown) {
            addMissingFact(
                "MISSING_FACT_PAL_TAL_REQUIRED",
                fieldKeys.palTalRequired,
                "PAL/TAL requirement must be set"
            );
        }

        if (palTal?.required === true) {
            const palSlot = slots.find((slot) => slot.slot_definition_id === "sp.pal_tal");
            if (!palSlot) {
                blockers.push({
                    code: "MISSING_DOC_PAL_TAL",
                    message: "PAL/TAL document is required",
                    fieldKey: fieldKeys.palTalDocument,
                });
            } else if (!palSlot.is_required && (palSlot.state === "missing" || palSlot.state === "rejected")) {
                blockers.push({
                    code: palSlot.state === "rejected" ? "REJECTED_DOC_PAL_TAL" : "MISSING_DOC_PAL_TAL",
                    message: "PAL/TAL document is required",
                    slotId: palSlot.id,
                    fieldKey: fieldKeys.palTalDocument,
                });
            }
        }
    }

    // Check for missing required slots
    for (const slot of slots) {
        if (!slot.is_required) continue;
        const isWaived = Boolean((slot.meta as Record<string, unknown> | null)?.waivedAt);
        if (isWaived) continue;

        if (slot.state === "missing") {
            blockers.push({
                code: "MISSING_REQUIRED_DOC",
                message: `Missing required document: ${slot.slot_definitions?.label || slot.slot_definition_id}`,
                slotId: slot.id,
            });
        }
        if (slot.state === "rejected") {
            blockers.push({
                code: "REJECTED_REQUIRED_DOC",
                message: `Document rejected: ${slot.slot_definitions?.label || slot.slot_definition_id}`,
                slotId: slot.id,
            });
        }
    }

    // Temporal logic
    let isMaintainedStatusEligible = false;
    let restorationRequired = false;
    let recommendedApplyBy: string | null = null;
    let restorationDeadlineAt: string | null = null;

    if (statusExpiryAt) {
        recommendedApplyBy = addDays(statusExpiryAt, -30);
        const daysUntilExpiry = daysBetween(today(), statusExpiryAt);

        if (daysUntilExpiry <= 30 && daysUntilExpiry > 14) {
            deadlines.push({
                key: "EXPIRY_30_DAYS",
                dueAt: statusExpiryAt,
                severity: "info",
                message: `Status expires in ${daysUntilExpiry} days. Consider submitting soon.`,
            });
        } else if (daysUntilExpiry <= 14 && daysUntilExpiry > 7) {
            deadlines.push({
                key: "EXPIRY_14_DAYS",
                dueAt: statusExpiryAt,
                severity: "warning",
                message: `Status expires in ${daysUntilExpiry} days. Submit soon to maintain status.`,
            });
        } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
            deadlines.push({
                key: "EXPIRY_7_DAYS",
                dueAt: statusExpiryAt,
                severity: "critical",
                message: `Status expires in ${daysUntilExpiry} days! Submit immediately.`,
            });
        } else if (daysUntilExpiry <= 0 && !submittedAt) {
            warnings.push({
                code: "STATUS_EXPIRED",
                message: "Status has expired. Restoration may be required.",
            });
            restorationRequired = true;
            restorationDeadlineAt = addDays(statusExpiryAt, 90);
        }

        if (submittedAt) {
            const submittedDate = submittedAt.split("T")[0];
            if (submittedDate <= statusExpiryAt) {
                isMaintainedStatusEligible = true;
            } else {
                restorationRequired = true;
                restorationDeadlineAt = addDays(statusExpiryAt, 90);
            }
        }
    }

    return {
        derived: {
            statusExpiryAt,
            recommendedApplyBy,
            isMaintainedStatusEligible,
            maintainedStatusConditions: isMaintainedStatusEligible ? "SAME_AS_CURRENT" : "NONE",
            restorationRequired,
            restorationDeadlineAt,
        },
        deadlines,
        blockers,
        warnings,
        isReadyToSubmit: blockers.length === 0,
    };
}
