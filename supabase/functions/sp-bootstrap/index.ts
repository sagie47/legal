import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
    StudyPermitBootstrapResponse,
    SlotWithDocument,
    CaseEvent,
    Principal,
    StudyPermitAttributes,
    Application,
    SlotScope,
    SlotState,
} from "../_shared/spContracts.ts";
import { evaluateStudyFromData, type SlotRow } from "../_shared/studyEvaluation.ts";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10;
const MAX_EVENTS = 25;
const EVENTS_DAYS_WINDOW = 7;

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

    try {
        const { searchParams } = new URL(req.url);
        const applicationId = searchParams.get("applicationId");

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

        // Validate user
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return jsonResponse({ error: "Invalid user" }, 401);
        }

        // Get user's org_id
        const { data: userRow, error: userRowError } = await supabase
            .from("users")
            .select("org_id")
            .eq("id", userData.user.id)
            .single();

        if (userRowError || !userRow) {
            return jsonResponse({ error: "Could not determine user organization" }, 403);
        }
        const userOrgId = userRow.org_id;

        // =========================================================================
        // 1. Fetch Application
        // =========================================================================
        const { data: appData, error: appError } = await supabase
            .from("applications")
            .select(`
                id, org_id, status, app_type, processing_context, action_intent,
                submitted_at, decision_at, created_at
            `)
            .eq("id", applicationId)
            .single();

        if (appError || !appData) {
            return jsonResponse({ error: "Application not found" }, 404);
        }

        if (appData.org_id !== userOrgId) {
            return jsonResponse({ error: "Forbidden" }, 403);
        }

        const application: Application = {
            id: appData.id,
            orgId: appData.org_id,
            status: appData.status || "draft",
            appType: appData.app_type,
            processingContext: appData.processing_context,
            actionIntent: appData.action_intent,
            submittedAt: appData.submitted_at,
            decisionAt: appData.decision_at,
            createdAt: appData.created_at,
        };

        // =========================================================================
        // 2. Fetch Study Permit Attributes
        // =========================================================================
        const { data: spData } = await supabase
            .from("study_permit_attributes")
            .select("*")
            .eq("application_id", applicationId)
            .single();

        let studyPermitAttributes: StudyPermitAttributes | null = null;
        if (spData) {
            studyPermitAttributes = {
                applicationId: spData.application_id,
                program: spData.program,
                outsideCanadaContext: spData.outside_canada_context,
                insideCanadaContext: spData.inside_canada_context,
                familyContext: spData.family_context,
                palTal: spData.pal_tal,
            };
        }

        // =========================================================================
        // 3. Fetch Principal Person
        // =========================================================================
        let principal: Principal | null = null;

        const { data: participantData } = await supabase
            .from("application_participants")
            .select("person_id")
            .eq("application_id", applicationId)
            .eq("role", "PRINCIPAL")
            .single();

        if (participantData?.person_id) {
            const { data: personData } = await supabase
                .from("persons")
                .select("id, identity, passport")
                .eq("id", participantData.person_id)
                .single();

            let currentStatus = null;
            const { data: statusData } = await supabase
                .from("person_statuses")
                .select("status_type, valid_from, valid_to, is_current, conditions")
                .eq("person_id", participantData.person_id)
                .eq("is_current", true)
                .single();

            if (statusData) {
                currentStatus = {
                    statusType: statusData.status_type,
                    validFrom: statusData.valid_from,
                    validTo: statusData.valid_to,
                    isCurrent: statusData.is_current,
                    conditions: statusData.conditions,
                };
            }

            if (personData) {
                principal = {
                    personId: personData.id,
                    identity: personData.identity,
                    passport: personData.passport,
                    currentStatus,
                };
            }
        }

        // =========================================================================
        // 4. Fetch Slots with Documents
        // =========================================================================
        const { data: slotsData, error: slotsError } = await supabase
            .from("slots")
            .select(`
                id, slot_definition_id, state, is_required, meta,
                slot_definitions (
                    label, group_name, help_text, scope
                )
            `)
            .eq("application_id", applicationId);

        if (slotsError) {
            console.error("Slots error:", slotsError);
        }

        const slotRows: SlotRow[] = (slotsData || []).map((s: any) => ({
            id: s.id,
            slot_definition_id: s.slot_definition_id,
            state: s.state,
            is_required: s.is_required,
            meta: s.meta,
            slot_definitions: s.slot_definitions,
        }));

        // Get active document links
        const slotIds = slotRows.map((s) => s.id);
        let documentLinks: { slot_id: string; document_file_id: string }[] = [];
        if (slotIds.length > 0) {
            const { data: linksData } = await supabase
                .from("document_links")
                .select("slot_id, document_file_id")
                .in("slot_id", slotIds)
                .eq("is_active", true);
            documentLinks = linksData || [];
        }

        // Get document files
        const fileIds = documentLinks.map((l) => l.document_file_id);
        let documentFiles: any[] = [];
        if (fileIds.length > 0) {
            const { data: filesData } = await supabase
                .from("document_files")
                .select("id, storage_path, file_name, file_size, mime_type, uploaded_by, created_at")
                .in("id", fileIds);
            documentFiles = filesData || [];
        }

        // Build maps
        const fileMap = new Map(documentFiles.map((f) => [f.id, f]));
        const linkMap = new Map(documentLinks.map((l) => [l.slot_id, l.document_file_id]));

        // Create signed URLs and build SlotWithDocument array
        const slots: SlotWithDocument[] = await Promise.all(
            slotRows.map(async (slot) => {
                const def = slot.slot_definitions;
                const fileId = linkMap.get(slot.id);
                let document = null;

                if (fileId) {
                    const file = fileMap.get(fileId);
                    if (file) {
                        let previewUrl = "";
                        try {
                            const { data: signedData } = await supabase.storage
                                .from(BUCKET)
                                .createSignedUrl(file.storage_path, SIGNED_URL_TTL_SECONDS);
                            previewUrl = signedData?.signedUrl || "";
                        } catch {
                            previewUrl = "";
                        }

                        document = {
                            id: file.id,
                            fileName: file.file_name,
                            fileSize: file.file_size || 0,
                            mimeType: file.mime_type,
                            previewUrl,
                            uploadedAt: file.created_at,
                            uploadedBy: file.uploaded_by,
                        };
                    }
                }

                return {
                    id: slot.id,
                    definitionId: slot.slot_definition_id,
                    label: def?.label || slot.slot_definition_id,
                    group: def?.group_name || "Other",
                    scope: (def?.scope || "PRINCIPAL") as SlotScope,
                    required: slot.is_required,
                    state: slot.state as SlotState,
                    document,
                };
            })
        );

        // =========================================================================
        // 5. Evaluate (compute fresh + persist to cache)
        // =========================================================================
        const insideCtxExpiry =
            (studyPermitAttributes?.insideCanadaContext as { currentStatusExpiresAt?: string } | null)
                ?.currentStatusExpiresAt || null;
        const statusExpiryAt = insideCtxExpiry || principal?.currentStatus?.validTo || null;
        const evaluation = evaluateStudyFromData({
            statusExpiryAt,
            submittedAt: application.submittedAt,
            processingContext: application.processingContext,
            actionIntent: application.actionIntent || null,
            program: studyPermitAttributes?.program || null,
            outsideCanadaContext: studyPermitAttributes?.outsideCanadaContext || null,
            insideCanadaContext: studyPermitAttributes?.insideCanadaContext || null,
            palTal: studyPermitAttributes?.palTal || null,
            slots: slotRows,
        });

        // Persist evaluation to cache table (fire-and-forget, never blocks)
        try {
            await supabase.from("application_evaluations").insert({
                org_id: userOrgId,
                application_id: applicationId,
                evaluation_data: evaluation,
            });
        } catch (persistErr) {
            console.warn("Failed to persist evaluation (table may not exist):", persistErr);
        }

        // =========================================================================
        // 6. Fetch Events (last 25 or 7 days)
        // =========================================================================
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - EVENTS_DAYS_WINDOW);

        const { data: eventsData } = await supabase
            .from("case_events")
            .select("id, event_type, occurred_at, actor_user_id, payload")
            .eq("application_id", applicationId)
            .gte("occurred_at", sevenDaysAgo.toISOString())
            .order("occurred_at", { ascending: false })
            .limit(MAX_EVENTS);

        const events: CaseEvent[] = (eventsData || []).map((e: any) => ({
            id: e.id,
            eventType: e.event_type,
            occurredAt: e.occurred_at,
            actorUserId: e.actor_user_id,
            payload: e.payload,
        }));

        // =========================================================================
        // 7. Fetch Extractions Summary
        // =========================================================================
        const { data: extractionsData } = await supabase
            .from("document_extractions")
            .select("slot_id, document_file_id, status, profile_key, finished_at")
            .eq("application_id", applicationId);

        const extractionsSummary = (extractionsData || []).map((e: any) => ({
            slotId: e.slot_id,
            fileId: e.document_file_id,
            status: e.status,
            profileKey: e.profile_key,
            finishedAt: e.finished_at,
        }));

        // =========================================================================
        // 8. Fetch Pending Proposals (filtered to exclude retired slots)
        // =========================================================================
        const { data: proposalsData } = await supabase
            .from("fact_proposals")
            .select(`
                id,
                field_key,
                target_entity_type,
                proposed_value_json,
                current_value_json,
                confidence,
                severity,
                source_anchor,
                source_slot_id,
                status
            `)
            .eq("application_id", applicationId)
            .in("status", ["pending"]);

        // Build a Set of active slot IDs for fast lookup
        const activeSlotIdSet = new Set(slotIds);

        // Filter out proposals from retired slots (slots that no longer exist for this application)
        const pendingProposals = (proposalsData || [])
            .filter((p: any) => !p.source_slot_id || activeSlotIdSet.has(p.source_slot_id))
            .map((p: any) => ({
                id: p.id,
                fieldKey: p.field_key,
                targetEntityType: p.target_entity_type,
                proposedValue: p.proposed_value_json,
                currentValue: p.current_value_json,
                confidence: parseFloat(p.confidence),
                severity: p.severity,
                sourceAnchor: p.source_anchor,
                sourceSlotId: p.source_slot_id,
            }));

        // =========================================================================
        // 9. Build Response
        // =========================================================================
        const response: StudyPermitBootstrapResponse = {
            application,
            studyPermitAttributes,
            principal,
            slots,
            evaluation,
            events,
            extractionsSummary,
            pendingProposals,
        };

        return jsonResponse(response);
    } catch (error: any) {
        console.error("sp-bootstrap error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
