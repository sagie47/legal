import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// TYPES
// =============================================================================

interface ResolveRequest {
    proposalId: string;
    action: "accept" | "reject";
    overrideValueJson?: unknown;
    reason?: string;
}

interface FactProposal {
    id: string;
    org_id: string;
    application_id: string;
    person_id: string | null;
    extraction_id: string;
    field_key: string;
    target_entity_type: string;
    target_entity_id: string | null;
    field_path: string;
    operation: string;
    proposed_value_json: unknown;
    current_value_json: unknown | null;
    confidence: string;
    severity: string;
    status: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

// =============================================================================
// CANONICAL WRITERS
// =============================================================================

/**
 * Writes a value to a canonical table based on target entity type.
 * Returns the updated value or throws on failure.
 */
async function writeToCanonical(
    supabase: any,
    proposal: FactProposal,
    valueToWrite: unknown
): Promise<unknown> {
    const { target_entity_type, target_entity_id, field_path, operation } = proposal;

    if (!target_entity_id) {
        throw new Error("target_entity_id is required for canonical write");
    }

    switch (target_entity_type) {
        case "person": {
            // Field path like "identity.familyName" or "passport.expiryDate"
            const [section, field] = field_path.split(".");

            // Get current person
            const { data: person, error: fetchError } = await supabase
                .from("persons")
                .select("*")
                .eq("id", target_entity_id)
                .single();

            if (fetchError) throw new Error(`Failed to fetch person: ${fetchError.message}`);

            // Update the nested field
            const currentSection = person[section] || {};
            const updatedSection = { ...currentSection, [field]: valueToWrite };

            const { error: updateError } = await supabase
                .from("persons")
                .update({ [section]: updatedSection, updated_at: new Date().toISOString() })
                .eq("id", target_entity_id);

            if (updateError) throw new Error(`Failed to update person: ${updateError.message}`);
            return valueToWrite;
        }

        case "person_status": {
            const { error: updateError } = await supabase
                .from("person_statuses")
                .update({ [field_path]: valueToWrite, updated_at: new Date().toISOString() })
                .eq("id", target_entity_id);

            if (updateError) throw new Error(`Failed to update person_status: ${updateError.message}`);
            return valueToWrite;
        }

        case "work_permit_attributes": {
            // Field path might be nested like "position.wage" or flat like "requestedValidTo"
            if (field_path.includes(".")) {
                const [section, field] = field_path.split(".");

                const { data: wpa, error: fetchError } = await supabase
                    .from("work_permit_attributes")
                    .select("*")
                    .eq("application_id", target_entity_id)
                    .single();

                if (fetchError) throw new Error(`Failed to fetch work_permit_attributes: ${fetchError.message}`);

                const currentSection = wpa[section] || {};
                const updatedSection = { ...currentSection, [field]: valueToWrite };

                const { error: updateError } = await supabase
                    .from("work_permit_attributes")
                    .update({ [section]: updatedSection, updated_at: new Date().toISOString() })
                    .eq("application_id", target_entity_id);

                if (updateError) throw new Error(`Failed to update work_permit_attributes: ${updateError.message}`);
            } else {
                const { error: updateError } = await supabase
                    .from("work_permit_attributes")
                    .update({ [field_path]: valueToWrite, updated_at: new Date().toISOString() })
                    .eq("application_id", target_entity_id);

                if (updateError) throw new Error(`Failed to update work_permit_attributes: ${updateError.message}`);
            }
            return valueToWrite;
        }
        case "study_permit_attributes": {
            if (field_path.includes(".")) {
                const [section, field] = field_path.split(".");

                const { data: spa, error: fetchError } = await supabase
                    .from("study_permit_attributes")
                    .select("*")
                    .eq("application_id", target_entity_id)
                    .single();

                if (fetchError) throw new Error(`Failed to fetch study_permit_attributes: ${fetchError.message}`);

                const currentSection = spa[section] || {};
                const updatedSection = { ...currentSection, [field]: valueToWrite };

                const { error: updateError } = await supabase
                    .from("study_permit_attributes")
                    .update({ [section]: updatedSection, updated_at: new Date().toISOString() })
                    .eq("application_id", target_entity_id);

                if (updateError) throw new Error(`Failed to update study_permit_attributes: ${updateError.message}`);
            } else {
                const { error: updateError } = await supabase
                    .from("study_permit_attributes")
                    .update({ [field_path]: valueToWrite, updated_at: new Date().toISOString() })
                    .eq("application_id", target_entity_id);

                if (updateError) throw new Error(`Failed to update study_permit_attributes: ${updateError.message}`);
            }
            return valueToWrite;
        }

        case "employer": {
            const { error: updateError } = await supabase
                .from("employers")
                .update({ [field_path]: valueToWrite, updated_at: new Date().toISOString() })
                .eq("id", target_entity_id);

            if (updateError) throw new Error(`Failed to update employer: ${updateError.message}`);
            return valueToWrite;
        }

        default:
            throw new Error(`Unknown target_entity_type: ${target_entity_type}`);
    }
}

/**
 * Gets current canonical value for compare-on-accept.
 */
async function getCurrentCanonicalValue(
    supabase: any,
    proposal: FactProposal
): Promise<unknown> {
    const { target_entity_type, target_entity_id, field_path } = proposal;

    if (!target_entity_id) return null;

    try {
        switch (target_entity_type) {
            case "person": {
                const [section, field] = field_path.split(".");
                const { data } = await supabase
                    .from("persons")
                    .select(section)
                    .eq("id", target_entity_id)
                    .single();
                return data?.[section]?.[field] ?? null;
            }
            case "person_status": {
                const { data } = await supabase
                    .from("person_statuses")
                    .select(field_path)
                    .eq("id", target_entity_id)
                    .single();
                return data?.[field_path] ?? null;
            }
            case "work_permit_attributes": {
                if (field_path.includes(".")) {
                    const [section, field] = field_path.split(".");
                    const { data } = await supabase
                        .from("work_permit_attributes")
                        .select(section)
                        .eq("application_id", target_entity_id)
                        .single();
                    return data?.[section]?.[field] ?? null;
                } else {
                    const { data } = await supabase
                        .from("work_permit_attributes")
                        .select(field_path)
                        .eq("application_id", target_entity_id)
                        .single();
                    return data?.[field_path] ?? null;
                }
            }
            case "study_permit_attributes": {
                if (field_path.includes(".")) {
                    const [section, field] = field_path.split(".");
                    const { data } = await supabase
                        .from("study_permit_attributes")
                        .select(section)
                        .eq("application_id", target_entity_id)
                        .single();
                    return data?.[section]?.[field] ?? null;
                } else {
                    const { data } = await supabase
                        .from("study_permit_attributes")
                        .select(field_path)
                        .eq("application_id", target_entity_id)
                        .single();
                    return data?.[field_path] ?? null;
                }
            }
            case "employer": {
                const { data } = await supabase
                    .from("employers")
                    .select(field_path)
                    .eq("id", target_entity_id)
                    .single();
                return data?.[field_path] ?? null;
            }
            default:
                return null;
        }
    } catch {
        return null;
    }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const body: ResolveRequest = await req.json();
        const { proposalId, action, overrideValueJson, reason } = body;

        if (!proposalId || !action) {
            return jsonResponse({ error: "proposalId and action are required" }, 400);
        }

        if (!["accept", "reject"].includes(action)) {
            return jsonResponse({ error: "action must be 'accept' or 'reject'" }, 400);
        }

        // Auth
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        if (!token) {
            return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        // Validate user
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return jsonResponse({ error: "Invalid user" }, 401);
        }
        const userId = userData.user.id;

        // Get user's org_id
        const { data: userRow } = await supabase
            .from("users")
            .select("org_id")
            .eq("id", userId)
            .single();

        if (!userRow?.org_id) {
            return jsonResponse({ error: "User not associated with organization" }, 403);
        }
        const userOrgId = userRow.org_id;

        // Fetch proposal
        const { data: proposal, error: proposalError } = await supabase
            .from("fact_proposals")
            .select("*")
            .eq("id", proposalId)
            .single();

        if (proposalError || !proposal) {
            return jsonResponse({ error: "Proposal not found" }, 404);
        }

        // Authorization check
        if (proposal.org_id !== userOrgId) {
            return jsonResponse({ error: "Not authorized to modify this proposal" }, 403);
        }

        // Check proposal is still pending
        if (proposal.status !== "pending") {
            return jsonResponse({ error: `Proposal is already ${proposal.status}` }, 400);
        }

        const now = new Date().toISOString();

        // Handle REJECT
        if (action === "reject") {
            // High severity rejections require reason
            if (proposal.severity === "high" && !reason) {
                return jsonResponse({ error: "Reason is required for high-severity rejections" }, 400);
            }

            await supabase
                .from("fact_proposals")
                .update({
                    status: "rejected",
                    reviewed_by_user_id: userId,
                    reviewed_at: now,
                    review_reason: reason || null,
                    updated_at: now,
                })
                .eq("id", proposalId);

            // Emit event
            await supabase.from("case_events").insert({
                org_id: proposal.org_id,
                application_id: proposal.application_id,
                event_type: "FACT_REJECTED",
                actor_user_id: userId,
                payload: {
                    proposalId,
                    fieldKey: proposal.field_key,
                    reason,
                },
            });

            return jsonResponse({ success: true, status: "rejected" });
        }

        // Handle ACCEPT
        // Compare-on-accept: check current canonical value
        const currentValue = await getCurrentCanonicalValue(supabase, proposal);
        const snapshotValue = proposal.current_value_json;

        // Detect conflict
        if (JSON.stringify(currentValue) !== JSON.stringify(snapshotValue)) {
            // Current differs from snapshot
            const valueToWrite = overrideValueJson ?? proposal.proposed_value_json;

            if (JSON.stringify(currentValue) === JSON.stringify(proposal.proposed_value_json)) {
                // Already applied - mark as noop
                await supabase
                    .from("fact_proposals")
                    .update({
                        status: "noop",
                        reviewed_by_user_id: userId,
                        reviewed_at: now,
                        review_reason: "Already applied",
                        updated_at: now,
                    })
                    .eq("id", proposalId);

                return jsonResponse({ success: true, status: "noop", message: "Value already applied" });
            }

            // Conflict: current differs and proposed != current
            if (!overrideValueJson) {
                return jsonResponse({
                    error: "conflict_current_changed",
                    message: "Canonical value has changed since proposal was created",
                    currentValue,
                    snapshotValue,
                    proposedValue: proposal.proposed_value_json,
                }, 409);
            }
        }

        // Determine value to write
        const valueToWrite = overrideValueJson ?? proposal.proposed_value_json;

        // High severity overrides require reason
        if (proposal.severity === "high" && overrideValueJson && !reason) {
            return jsonResponse({ error: "Reason is required for high-severity overrides" }, 400);
        }

        // Write to canonical
        await writeToCanonical(supabase, proposal, valueToWrite);

        // Mark proposal accepted
        await supabase
            .from("fact_proposals")
            .update({
                status: "accepted",
                reviewed_by_user_id: userId,
                reviewed_at: now,
                review_reason: reason || null,
                updated_at: now,
            })
            .eq("id", proposalId);

        // Emit event
        await supabase.from("case_events").insert({
            org_id: proposal.org_id,
            application_id: proposal.application_id,
            event_type: "FACT_ACCEPTED",
            actor_user_id: userId,
            payload: {
                proposalId,
                fieldKey: proposal.field_key,
                extractionId: proposal.extraction_id,
                documentFileId: proposal.source_document_file_id,
                valueWritten: valueToWrite,
            },
        });

        return jsonResponse({
            success: true,
            status: "accepted",
            fieldKey: proposal.field_key,
            valueWritten: valueToWrite,
        });

    } catch (error: any) {
        console.error("fact-proposals/resolve error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
