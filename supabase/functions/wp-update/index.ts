import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
    WorkPermitUpdateRequest,
    WorkPermitUpdateResponse,
    SlotWithDocument,
    SlotScope,
    SlotState,
} from "../_shared/contracts.ts";
import { evaluateFromData, type SlotRow } from "../_shared/evaluation.ts";

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

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
// SLOT REGENERATION LOGIC
// =============================================================================

interface SlotDefinition {
    id: string;
    scope: string;
    is_required: boolean;
}

interface SlotPack {
    id: string;
    app_type: string;
    processing_context: string | null;
    action_intent: string | null;
    program_type: string | null;
    authorization_model: string | null;
    sub_type_code: string | null;
    match_predicates: Record<string, unknown> | null;
    is_base: boolean;
}

interface SlotPackItem {
    pack_id: string;
    slot_definition_id: string;
    is_required_override: boolean | null;
    display_order: number | null;
}

async function regenerateSlots(
    supabase: any,
    applicationId: string,
    orgId: string,
    dimensions: {
        appType: string;
        processingContext: string;
        actionIntent: string;
        programType?: string | null;
        authorizationModel?: string | null;
        subTypeCode?: string | null;
    }
): Promise<void> {
    // Fetch slot packs for this app type
    const { data: packsData, error: packsError } = await supabase
        .from("slot_packs")
        .select("*")
        .eq("app_type", dimensions.appType);

    if (packsError) {
        console.error("Error fetching slot packs:", packsError);
        return;
    }

    const packs = (packsData as SlotPack[]) || [];
    if (packs.length === 0) {
        console.warn("No slot packs configured for app type:", dimensions.appType);
        return;
    }

    // Fetch participants to resolve spouse/dependent predicates
    const { data: participants } = await supabase
        .from("application_participants")
        .select("role, person_id")
        .eq("application_id", applicationId);

    const hasSpouse = (participants || []).some((p: { role: string }) => p.role === "SPOUSE");
    const hasDependents = (participants || []).some((p: { role: string }) => p.role === "CHILD" || p.role === "DEPENDENT");

    // Fetch Outside Canada context for legal status doc predicate
    const { data: wpAttrs } = await supabase
        .from("work_permit_attributes")
        .select("outside_canada_context")
        .eq("application_id", applicationId)
        .maybeSingle();

    const outsideCtx = (wpAttrs?.outside_canada_context || {}) as {
        countryOfResidence?: string;
        countryOfCitizenship?: string;
    };
    const residence = typeof outsideCtx.countryOfResidence === "string" ? outsideCtx.countryOfResidence : null;
    const citizenship = typeof outsideCtx.countryOfCitizenship === "string" ? outsideCtx.countryOfCitizenship : null;
    const requiresLegalStatusDoc = Boolean(
        residence &&
        citizenship &&
        residence.toLowerCase() !== citizenship.toLowerCase()
    );

    const matchesPack = (pack: SlotPack): boolean => {
        if (pack.processing_context && pack.processing_context !== dimensions.processingContext) return false;
        if (pack.action_intent && pack.action_intent !== dimensions.actionIntent) return false;
        if (pack.program_type && pack.program_type !== dimensions.programType) return false;
        if (pack.authorization_model && pack.authorization_model !== dimensions.authorizationModel) return false;
        if (pack.sub_type_code && pack.sub_type_code !== dimensions.subTypeCode) return false;

        const predicates = (pack.match_predicates || {}) as Record<string, unknown>;
        if (Boolean(predicates.requiresSpouse) && !hasSpouse) return false;
        if (Boolean(predicates.requiresDependents) && !hasDependents) return false;
        if (Boolean(predicates.requiresLegalStatusDoc) && !requiresLegalStatusDoc) return false;

        return true;
    };

    const applicablePacks = packs.filter(matchesPack);
    const activePacks = applicablePacks.filter((p) => p.is_base).concat(applicablePacks.filter((p) => !p.is_base));
    const activePackIds = activePacks.map((p) => p.id);

    if (activePackIds.length === 0) {
        console.warn("No active slot packs matched for dimensions:", dimensions);
        return;
    }

    // Fetch pack items for active packs
    const { data: packItemsData, error: packItemsError } = await supabase
        .from("slot_pack_items")
        .select("pack_id, slot_definition_id, is_required_override, display_order")
        .in("pack_id", activePackIds);

    if (packItemsError) {
        console.error("Error fetching slot pack items:", packItemsError);
        return;
    }

    const packItems = (packItemsData as SlotPackItem[]) || [];
    if (packItems.length === 0) {
        console.warn("No slot pack items found for packs:", activePackIds);
        return;
    }

    const slotDefinitionIds = Array.from(new Set(packItems.map((i) => i.slot_definition_id)));
    const { data: defsData, error: defsError } = await supabase
        .from("slot_definitions")
        .select("id, scope, is_required")
        .in("id", slotDefinitionIds);

    if (defsError) {
        console.error("Error fetching slot definitions:", defsError);
        return;
    }

    const slotDefs = (defsData as SlotDefinition[]) || [];
    const slotDefsMap = new Map(slotDefs.map((d) => [d.id, d]));

    const requiredMap = new Map<string, boolean>();
    for (const item of packItems) {
        const baseRequired = item.is_required_override ?? slotDefsMap.get(item.slot_definition_id)?.is_required ?? false;
        const existing = requiredMap.get(item.slot_definition_id);
        requiredMap.set(item.slot_definition_id, existing ? existing || baseRequired : baseRequired);
    }

    const matchingDefIds = new Set(slotDefinitionIds);

    // Get principal person for scoped slots
    const principalPersonId = (participants || []).find((p: { role: string }) => p.role === "PRINCIPAL")?.person_id || null;

    // Get existing slots for this application
    const { data: existingSlots } = await supabase
        .from("slots")
        .select("id, slot_definition_id, is_required, state, meta")
        .eq("application_id", applicationId);

    interface ExistingSlot {
        id: string;
        slot_definition_id: string;
        is_required: boolean;
        state: string;
        meta: Record<string, unknown> | null;
    }

    const existingSlotsMap = new Map<string, ExistingSlot>(
        (existingSlots || []).map((s: ExistingSlot) => [s.slot_definition_id, s])
    );

    // Upsert matching slots (create new or restore retired)
    const activeDefs = slotDefs.filter((def) => matchingDefIds.has(def.id));
    for (const def of activeDefs) {
        const personId = def.scope === "PRINCIPAL" ? principalPersonId : null;
        const existing = existingSlotsMap.get(def.id);
        const requiredFlag = requiredMap.get(def.id) ?? def.is_required;

        if (!existing) {
            // Create new slot
            await supabase.from("slots").insert({
                org_id: orgId,
                application_id: applicationId,
                slot_definition_id: def.id,
                person_id: personId,
                state: "missing",
                is_required: requiredFlag,
            });
        } else {
            const hasRetiredMeta = Boolean(existing.meta && (existing.meta as Record<string, unknown>).retiredAt);
            if (existing.is_required !== requiredFlag || hasRetiredMeta) {
                const nextMeta = { ...(existing.meta || {}) } as Record<string, unknown>;
                delete nextMeta.retiredAt;
                delete nextMeta.retiredReason;

                await supabase.from("slots")
                    .update({
                        is_required: requiredFlag,
                        meta: Object.keys(nextMeta).length > 0 ? nextMeta : null,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", existing.id);
            }
        }
    }

    // SLOT RETIREMENT: Mark slots that no longer match as not required
    // This prevents them from blocking submit while preserving uploaded documents
    const retiredSlotIds: string[] = [];
    for (const [defId, slot] of existingSlotsMap) {
        const meta = (slot.meta || {}) as Record<string, unknown>;
        const alreadyRetired = Boolean(meta.retiredAt);
        if (!matchingDefIds.has(defId) && !alreadyRetired) {
            retiredSlotIds.push(slot.id);
            await supabase.from("slots")
                .update({
                    is_required: false,
                    meta: {
                        ...meta,
                        retiredAt: new Date().toISOString(),
                        retiredReason: "pack_mismatch",
                    },
                    updated_at: new Date().toISOString()
                })
                .eq("id", slot.id);
        }
    }

    if (retiredSlotIds.length > 0) {
        await supabase
            .from("fact_proposals")
            .update({
                status: "irrelevant",
                updated_at: new Date().toISOString(),
            })
            .in("source_slot_id", retiredSlotIds)
            .eq("status", "pending");
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
        const body: WorkPermitUpdateRequest = await req.json();
        const {
            applicationId,
            programType,
            authorizationModel,
            subTypeCode,
            actionIntent,
            currentEmployerId,
            currentStatusExpiresAt,
            insideCanadaContext,
            authorizationArtifact,
            openBasis,
            outsideCanadaContext,
        } = body;

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

        // Get application
        const { data: appData, error: appError } = await supabase
            .from("applications")
            .select("id, org_id, app_type, processing_context, action_intent, submitted_at")
            .eq("id", applicationId)
            .single();

        if (appError || !appData) {
            return jsonResponse({ error: "Application not found" }, 404);
        }

        if (appData.org_id !== userOrgId) {
            return jsonResponse({ error: "Forbidden" }, 403);
        }

        // =========================================================================
        // 0. Load existing WP attributes (for merges)
        // =========================================================================
        const { data: existingWp } = await supabase
            .from("work_permit_attributes")
            .select("program_type, authorization_model, sub_type_code, action_intent, current_employer_id, authorization_artifact, open_basis, inside_canada_context, outside_canada_context")
            .eq("application_id", applicationId)
            .maybeSingle();

        const effectiveProgramType = programType ?? existingWp?.program_type ?? null;
        const effectiveAuthModel = authorizationModel ?? existingWp?.authorization_model ?? null;
        const effectiveSubTypeCode = subTypeCode ?? existingWp?.sub_type_code ?? null;
        const actionIntentValue = actionIntent ?? existingWp?.action_intent ?? appData.action_intent ?? null;

        // =========================================================================
        // 1. Update work_permit_attributes
        // =========================================================================
        const updatePayload: Record<string, unknown> = {
            application_id: applicationId,
            org_id: appData.org_id,
            updated_at: new Date().toISOString(),
        };

        if (programType !== undefined) updatePayload.program_type = programType;
        if (authorizationModel !== undefined) updatePayload.authorization_model = authorizationModel;
        if (subTypeCode !== undefined) updatePayload.sub_type_code = subTypeCode;
        if (actionIntent !== undefined) updatePayload.action_intent = actionIntent;
        if (currentEmployerId !== undefined) updatePayload.current_employer_id = currentEmployerId;

        // Upsert
        const { error: wpError } = await supabase
            .from("work_permit_attributes")
            .upsert(updatePayload, { onConflict: "application_id" });

        if (wpError) {
            console.error("WP attributes update error:", wpError);
            return jsonResponse({ error: "Failed to update work permit attributes" }, 500);
        }

        // =========================================================================
        // 2. Update person_statuses if currentStatusExpiresAt provided
        // =========================================================================
        const nextStatusExpiryAt = currentStatusExpiresAt ?? insideCanadaContext?.currentStatusExpiresAt;
        if (nextStatusExpiryAt) {
            const { data: participant } = await supabase
                .from("application_participants")
                .select("person_id")
                .eq("application_id", applicationId)
                .eq("role", "PRINCIPAL")
                .single();

            if (participant?.person_id) {
                // Mark existing statuses as not current
                await supabase
                    .from("person_statuses")
                    .update({ is_current: false })
                    .eq("person_id", participant.person_id);

                // Insert new current status (we already marked old ones as not current)
                const { error: statusError } = await supabase
                    .from("person_statuses")
                    .insert({
                        org_id: appData.org_id,
                        person_id: participant.person_id,
                        status_type: "WORK_PERMIT",
                        valid_to: nextStatusExpiryAt,
                        is_current: true,
                    });

                if (statusError) {
                    console.error("Status insert error:", statusError);
                }
            }

        }

        // =========================================================================
        // 2b. Merge JSON fact fields (authorization_artifact, open_basis, contexts)
        // =========================================================================
        const jsonUpdates: Record<string, unknown> = {};

        if (authorizationArtifact !== undefined && authorizationArtifact !== null) {
            const nextAuthArtifact = {
                ...(existingWp?.authorization_artifact || {}),
                ...authorizationArtifact,
            } as Record<string, unknown>;

            if (effectiveAuthModel === "EMPLOYER_SPECIFIC" && !nextAuthArtifact.kind && effectiveProgramType) {
                nextAuthArtifact.kind = effectiveProgramType === "TFWP" ? "LMIA" : "EMPLOYER_PORTAL_OFFER";
            }

            jsonUpdates.authorization_artifact = nextAuthArtifact;
        }

        if (openBasis !== undefined && openBasis !== null) {
            jsonUpdates.open_basis = {
                ...(existingWp?.open_basis || {}),
                ...openBasis,
            };
        }

        if (outsideCanadaContext !== undefined && outsideCanadaContext !== null) {
            jsonUpdates.outside_canada_context = {
                ...(existingWp?.outside_canada_context || {}),
                ...outsideCanadaContext,
            };
        }

        const hasInsideContextUpdate = insideCanadaContext !== undefined && insideCanadaContext !== null;
        const hasExpiryUpdate = currentStatusExpiresAt !== undefined && currentStatusExpiresAt !== null;
        if (hasInsideContextUpdate || hasExpiryUpdate) {
            const nextInsideCanadaContext = {
                ...(existingWp?.inside_canada_context || {}),
                ...(insideCanadaContext || {}),
            } as Record<string, unknown>;

            if (hasExpiryUpdate) {
                nextInsideCanadaContext.currentStatusExpiresAt = currentStatusExpiresAt;
            }

            jsonUpdates.inside_canada_context = nextInsideCanadaContext;
        }

        if (Object.keys(jsonUpdates).length > 0) {
            await supabase
                .from("work_permit_attributes")
                .update({
                    ...jsonUpdates,
                    updated_at: new Date().toISOString(),
                })
                .eq("application_id", applicationId);
        }

        // =========================================================================
        // 3. Regenerate slots (idempotent)
        // =========================================================================
        const effectiveProcessingContext = appData.processing_context || "INSIDE_CANADA";
        const effectiveActionIntent = actionIntentValue ||
            (effectiveProcessingContext === "OUTSIDE_CANADA" ? "APPLY" : "EXTEND");

        await regenerateSlots(supabase, applicationId, appData.org_id, {
            appType: appData.app_type || "WORK_PERMIT",
            processingContext: effectiveProcessingContext,
            actionIntent: effectiveActionIntent,
            programType: effectiveProgramType,
            authorizationModel: effectiveAuthModel,
            subTypeCode: effectiveSubTypeCode,
        });

        // =========================================================================
        // 4. Emit event
        // =========================================================================
        await supabase.from("case_events").insert({
            org_id: appData.org_id,
            application_id: applicationId,
            event_type: "WP_ATTRIBUTES_UPDATED",
            occurred_at: new Date().toISOString(),
            actor_user_id: userData.user.id,
            payload: {
                programType,
                authorizationModel,
                subTypeCode,
                actionIntent,
                currentEmployerId,
                currentStatusExpiresAt,
                insideCanadaContext,
                authorizationArtifact,
                openBasis,
                outsideCanadaContext,
            },
        });

        // =========================================================================
        // 5. Fetch updated slots and re-evaluate
        // =========================================================================
        const { data: slotsData } = await supabase
            .from("slots")
            .select(`
                id, slot_definition_id, state, is_required, meta,
                slot_definitions (label, group_name, help_text, scope)
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

        const fileIds = documentLinks.map((l) => l.document_file_id);
        let documentFiles: any[] = [];
        if (fileIds.length > 0) {
            const { data: filesData } = await supabase
                .from("document_files")
                .select("id, storage_path, file_name, file_size, mime_type, uploaded_by, created_at")
                .in("id", fileIds);
            documentFiles = filesData || [];
        }

        const fileMap = new Map(documentFiles.map((f) => [f.id, f]));
        const linkMap = new Map(documentLinks.map((l) => [l.slot_id, l.document_file_id]));

        // Build slots with signed URLs
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

        // Get status expiry for evaluation
        let statusExpiryAt: string | null = currentStatusExpiresAt || null;
        if (!statusExpiryAt) {
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
                statusExpiryAt = statusData?.valid_to || null;
            }
        }

        const { data: wpAttrs } = await supabase
            .from("work_permit_attributes")
            .select("program_type, authorization_model, action_intent, current_employer_id, authorization_artifact, open_basis, outside_canada_context, inside_canada_context")
            .eq("application_id", applicationId)
            .single();

        const insideCtxExpiry =
            (wpAttrs?.inside_canada_context as { currentStatusExpiresAt?: string } | null)
                ?.currentStatusExpiresAt || null;
        statusExpiryAt = insideCtxExpiry || statusExpiryAt || null;

        const evaluation = evaluateFromData({
            statusExpiryAt,
            submittedAt: appData.submitted_at,
            processingContext: appData.processing_context,
            actionIntent: wpAttrs?.action_intent || null,
            authorizationModel: wpAttrs?.authorization_model || null,
            programType: wpAttrs?.program_type || null,
            currentEmployerId: wpAttrs?.current_employer_id || null,
            authorizationArtifact: wpAttrs?.authorization_artifact || null,
            openBasis: wpAttrs?.open_basis || null,
            outsideCanadaContext: wpAttrs?.outside_canada_context || null,
            slots: slotRows,
        });

        const response: WorkPermitUpdateResponse = {
            success: true,
            evaluation,
            slots,
        };

        return jsonResponse(response);
    } catch (error: any) {
        console.error("wp-update error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
