import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
    StudyPermitSubmitRequest,
    StudyPermitSubmitResponse,
} from "../_shared/spContracts.ts";
import { evaluateStudyFromData, type SlotRow } from "../_shared/studyEvaluation.ts";

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
// HELPERS
// =============================================================================

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

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
        const body: StudyPermitSubmitRequest = await req.json();
        const { applicationId } = body;

        if (!applicationId) {
            return jsonResponse({ error: "applicationId is required" }, 400);
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

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return jsonResponse({ error: "Invalid user" }, 401);
        }

        const { data: userRow } = await supabase
            .from("users")
            .select("org_id")
            .eq("id", userData.user.id)
            .single();

        if (!userRow) {
            return jsonResponse({ error: "Could not determine user organization" }, 403);
        }
        const userOrgId = userRow.org_id;

        // =========================================================================
        // 1. Get application
        // =========================================================================
        const { data: appData, error: appError } = await supabase
            .from("applications")
            .select("id, org_id, processing_context, action_intent, submitted_at")
            .eq("id", applicationId)
            .single();

        if (appError || !appData) {
            return jsonResponse({ error: "Application not found" }, 404);
        }

        if (appData.org_id !== userOrgId) {
            return jsonResponse({ error: "Forbidden" }, 403);
        }

        // =========================================================================
        // 2. Get study permit attributes and current status expiry
        // =========================================================================
        const { data: spAttrs } = await supabase
            .from("study_permit_attributes")
            .select("program, outside_canada_context, inside_canada_context, pal_tal")
            .eq("application_id", applicationId)
            .single();

        const insideCtxExpiry =
            (spAttrs?.inside_canada_context as { currentStatusExpiresAt?: string } | null)
                ?.currentStatusExpiresAt || null;
        let statusExpiryAt: string | null = insideCtxExpiry || null;

        const { data: participant } = await supabase
            .from("application_participants")
            .select("person_id")
            .eq("application_id", applicationId)
            .eq("role", "PRINCIPAL")
            .single();

        if (participant?.person_id) {
            const { data: statusData } = await supabase
                .from("person_statuses")
                .select("valid_to")
                .eq("person_id", participant.person_id)
                .eq("is_current", true)
                .single();
            statusExpiryAt = insideCtxExpiry || statusData?.valid_to || null;
        }

        // =========================================================================
        // 3. Get slots and evaluate (pre-submission check)
        // =========================================================================
        const { data: slotsData } = await supabase
            .from("slots")
            .select(`
                id, slot_definition_id, state, is_required, meta,
                slot_definitions (label)
            `)
            .eq("application_id", applicationId);

        const slotRows: SlotRow[] = (slotsData || []).map((s: any) => ({
            id: s.id,
            slot_definition_id: s.slot_definition_id,
            state: s.state,
            is_required: s.is_required,
            meta: s.meta,
            slot_definitions: s.slot_definitions,
        }));

        const preEvaluation = evaluateStudyFromData({
            statusExpiryAt,
            submittedAt: null,
            processingContext: appData.processing_context,
            actionIntent: appData.action_intent || null,
            program: spAttrs?.program || null,
            outsideCanadaContext: spAttrs?.outside_canada_context || null,
            insideCanadaContext: spAttrs?.inside_canada_context || null,
            palTal: spAttrs?.pal_tal || null,
            slots: slotRows,
        });

        // =========================================================================
        // 4. Check for blockers - reject if any exist
        // =========================================================================
        if (preEvaluation.blockers.length > 0) {
            const response: StudyPermitSubmitResponse = {
                success: false,
                blockers: preEvaluation.blockers,
            };
            return jsonResponse(response, 400);
        }

        // =========================================================================
        // 5. Set submitted_at
        // =========================================================================
        const submittedAt = new Date().toISOString();

        const { error: updateError } = await supabase
            .from("applications")
            .update({
                submitted_at: submittedAt,
                status: "submitted",
                updated_at: submittedAt,
            })
            .eq("id", applicationId);

        if (updateError) {
            console.error("Error updating application:", updateError);
            return jsonResponse({ error: "Failed to submit application" }, 500);
        }

        // =========================================================================
        // 6. Emit APPLICATION_SUBMITTED event
        // =========================================================================
        await supabase.from("case_events").insert({
            org_id: userOrgId,
            application_id: applicationId,
            event_type: "APPLICATION_SUBMITTED",
            occurred_at: submittedAt,
            actor_user_id: userData.user.id,
            payload: {
                statusExpiryAt,
                submittedBeforeExpiry: statusExpiryAt ? submittedAt.split("T")[0] <= statusExpiryAt : null,
            },
        });

        // =========================================================================
        // 7. Re-evaluate with submission timestamp
        // =========================================================================
        const finalEvaluation = evaluateStudyFromData({
            statusExpiryAt,
            submittedAt,
            processingContext: appData.processing_context,
            actionIntent: appData.action_intent || null,
            program: spAttrs?.program || null,
            outsideCanadaContext: spAttrs?.outside_canada_context || null,
            insideCanadaContext: spAttrs?.inside_canada_context || null,
            palTal: spAttrs?.pal_tal || null,
            slots: slotRows,
        });

        const response: StudyPermitSubmitResponse = {
            success: true,
            evaluation: finalEvaluation,
        };

        return jsonResponse(response);
    } catch (error: any) {
        console.error("sp-submit error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
