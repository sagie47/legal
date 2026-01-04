/**
 * Shared Evaluation Logic for WP Inside Canada Extend
 * 
 * This module is the single source of truth for evaluation logic.
 * Used by wp-bootstrap, wp-update, and wp-submit edge functions.
 */

import type { Evaluation, Blocker, Warning, Deadline } from "./contracts.ts";

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

/**
 * Evaluates an application based on status expiry, submission date, and slot data.
 * Returns a complete Evaluation object ready for UI consumption.
 */
export interface EvaluationInput {
    statusExpiryAt: string | null;
    submittedAt: string | null;
    processingContext: string | null;
    actionIntent: string | null;
    authorizationModel: string | null;
    programType: string | null;
    currentEmployerId: string | null;
    authorizationArtifact: {
        kind?: string;
        refNumber?: string;
        exemptionCode?: string;
    } | null;
    openBasis: {
        basisCode?: string;
        policyPack?: string;
    } | null;
    outsideCanadaContext: {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
        hasLegalStatusInResidenceCountry?: boolean;
    } | null;
    slots: SlotRow[];
}

export function evaluateFromData(input: EvaluationInput): Evaluation {
    const {
        statusExpiryAt,
        submittedAt,
        processingContext,
        actionIntent,
        authorizationModel,
        programType,
        currentEmployerId,
        authorizationArtifact,
        openBasis,
        outsideCanadaContext,
        slots,
    } = input;
    const blockers: Blocker[] = [];
    const warnings: Warning[] = [];
    const deadlines: Deadline[] = [];

    const isInsideCanada = processingContext === "INSIDE_CANADA";
    const isOutsideCanada = processingContext === "OUTSIDE_CANADA";
    const effectiveActionIntent = actionIntent ||
        (processingContext === "OUTSIDE_CANADA" ? "APPLY" : "EXTEND");

    const fieldKeys = {
        processingContext: "workPermit.processingContext",
        actionIntent: "workPermit.actionIntent",
        authorizationModel: "workPermit.authorizationModel",
        programType: "workPermit.programType",
        currentEmployerId: "workPermit.currentEmployerId",
        statusExpiryAt: "workPermit.insideCanadaContext.currentStatusExpiresAt",
        authorizationRefNumber: "workPermit.authorizationArtifact.refNumber",
        openBasisCode: "workPermit.openBasis.basisCode",
        outsideCountryFacts: "workPermit.outsideCanadaContext",
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

    if (!authorizationModel) {
        addMissingFact(
            "MISSING_FACT_AUTHORIZATION_MODEL",
            fieldKeys.authorizationModel,
            "Authorization model is required"
        );
    }

    // Check for status expiry only for Inside Canada extensions/restorations/changes
    const requiresStatusExpiry = isInsideCanada &&
        ["EXTEND", "RESTORE", "CHANGE_EMPLOYER"].includes(effectiveActionIntent);
    if (requiresStatusExpiry && !statusExpiryAt) {
        addMissingFact(
            "MISSING_FACT_CURRENT_STATUS_EXPIRES_AT",
            fieldKeys.statusExpiryAt,
            "Current status expiry date is required for inside Canada applications"
        );
    }

    // Required facts for employer-specific permits
    if (authorizationModel === "EMPLOYER_SPECIFIC") {
        if (!currentEmployerId) {
            addMissingFact(
                "MISSING_FACT_CURRENT_EMPLOYER",
                fieldKeys.currentEmployerId,
                "Current employer is required for employer-specific work permits"
            );
        }

        if (!programType) {
            addMissingFact(
                "MISSING_FACT_PROGRAM_TYPE",
                fieldKeys.programType,
                "Program type is required for employer-specific work permits"
            );
        }

        if (programType === "IMP" && !authorizationArtifact?.refNumber) {
            addMissingFact(
                "MISSING_FACT_IMP_OFFER_NUMBER",
                fieldKeys.authorizationRefNumber,
                "Offer of Employment number is required for employer-specific IMP cases"
            );
        }

        if (programType === "TFWP" && !authorizationArtifact?.refNumber) {
            addMissingFact(
                "MISSING_FACT_LMIA_REF",
                fieldKeys.authorizationRefNumber,
                "LMIA number is required for employer-specific TFWP cases"
            );
        }
    }

    // Required facts for open permits
    if (authorizationModel === "OPEN") {
        if (!openBasis?.basisCode) {
            addMissingFact(
                "MISSING_FACT_OPEN_BASIS",
                fieldKeys.openBasisCode,
                "Open work permit basis is required"
            );
        }
    }

    // Required facts for Outside Canada cases
    if (isOutsideCanada) {
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
    }

    // Check for missing required slots (retired slots won't block)
    for (const slot of slots) {
        // Only required slots can block submission
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

        // Deadline warnings
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

        // Maintained status check
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
