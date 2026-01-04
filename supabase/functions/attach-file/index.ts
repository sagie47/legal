import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type {
    AttachFileRequest,
    AttachFileResponse,
    SlotWithDocument,
    SlotScope,
    SlotState,
} from "../_shared/contracts.ts";

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
        const body: AttachFileRequest = await req.json();
        const { slotId, documentFileId } = body;

        if (!slotId || !documentFileId) {
            return jsonResponse({ error: "slotId and documentFileId are required" }, 400);
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
        // 1. Get slot and verify org membership
        // =========================================================================
        const { data: slotData, error: slotError } = await supabase
            .from("slots")
            .select(`
                id, org_id, application_id, slot_definition_id, state, is_required, meta,
                slot_definitions (label, group_name, help_text, scope)
            `)
            .eq("id", slotId)
            .single();

        if (slotError || !slotData) {
            return jsonResponse({ error: "Slot not found" }, 404);
        }

        if (slotData.org_id !== userOrgId) {
            return jsonResponse({ error: "Forbidden" }, 403);
        }

        // =========================================================================
        // 2. Verify document file exists and belongs to org
        // =========================================================================
        const { data: fileData, error: fileError } = await supabase
            .from("document_files")
            .select("id, org_id, storage_path, file_name, file_size, mime_type, uploaded_by, created_at, file_sha256, sha256")
            .eq("id", documentFileId)
            .single();

        if (fileError || !fileData) {
            return jsonResponse({ error: "Document file not found" }, 404);
        }

        if (fileData.org_id !== userOrgId) {
            return jsonResponse({ error: "Forbidden: document does not belong to org" }, 403);
        }

        // =========================================================================
        // 3. Deactivate existing document links for this slot
        // =========================================================================
        const { error: deactivateError } = await supabase
            .from("document_links")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("slot_id", slotId)
            .eq("is_active", true);

        if (deactivateError) {
            console.error("Error deactivating old links:", deactivateError);
        }

        // =========================================================================
        // 4. Create new active document link
        // =========================================================================
        const { error: linkError } = await supabase.from("document_links").insert({
            org_id: userOrgId,
            document_file_id: documentFileId,
            slot_id: slotId,
            application_id: slotData.application_id,
            is_active: true,
        });

        if (linkError) {
            console.error("Error creating link:", linkError);
            return jsonResponse({ error: "Failed to attach file" }, 500);
        }

        // =========================================================================
        // 5. Update slot state to 'uploaded'
        // =========================================================================
        const { error: slotUpdateError } = await supabase
            .from("slots")
            .update({ state: "uploaded", updated_at: new Date().toISOString() })
            .eq("id", slotId);

        if (slotUpdateError) {
            console.error("Error updating slot state:", slotUpdateError);
        }

        // =========================================================================
        // 6. Emit event
        // =========================================================================
        await supabase.from("case_events").insert({
            org_id: userOrgId,
            application_id: slotData.application_id,
            event_type: "SLOT_DOCUMENT_ATTACHED",
            occurred_at: new Date().toISOString(),
            actor_user_id: userData.user.id,
            payload: {
                slotId,
                slotDefinitionId: slotData.slot_definition_id,
                documentFileId,
                fileName: fileData.file_name,
            },
        });

        // =========================================================================
        // 7. Enqueue OCR extraction if applicable
        // =========================================================================
        // Check if application uses new docs system and slot has extraction profile
        const { data: appData } = await supabase
            .from("applications")
            .select("uses_new_docs")
            .eq("id", slotData.application_id)
            .single();

        const { data: slotDefData } = await supabase
            .from("slot_definitions")
            .select("extraction_profile")
            .eq("id", slotData.slot_definition_id)
            .single();

        const usesNewDocs = appData?.uses_new_docs === true;
        const extractionProfile = slotDefData?.extraction_profile;

        if (usesNewDocs && extractionProfile) {
            // Compute idempotency key (file_id + profile + version)
            const engineVersion = "v1.0";
            const fileSha256 = fileData.file_sha256 || fileData.sha256 || fileData.id; // Fallback to file ID
            const idempotencyKey = `${fileSha256}:${extractionProfile}:${engineVersion}`;

            // Calculate retention window (30 days)
            const rawJsonExpiresAt = new Date();
            rawJsonExpiresAt.setDate(rawJsonExpiresAt.getDate() + 30);

            // Get principal person_id for context
            const { data: participant } = await supabase
                .from("application_participants")
                .select("person_id")
                .eq("application_id", slotData.application_id)
                .eq("role", "PRINCIPAL")
                .maybeSingle();

            // Upsert extraction (idempotent)
            const { data: extraction, error: extractionError } = await supabase
                .from("document_extractions")
                .upsert({
                    org_id: userOrgId,
                    application_id: slotData.application_id,
                    person_id: participant?.person_id || null,
                    slot_id: slotId,
                    document_file_id: documentFileId,
                    provider: "documentai",
                    profile_key: extractionProfile,
                    engine_version: engineVersion,
                    idempotency_key: idempotencyKey,
                    status: "queued",
                    raw_json_expires_at: rawJsonExpiresAt.toISOString(),
                }, {
                    onConflict: "idempotency_key",
                    ignoreDuplicates: true,
                })
                .select("id")
                .single();

            // Emit OCR_QUEUED event (only if new extraction was created)
            if (!extractionError && extraction) {
                await supabase.from("case_events").insert({
                    org_id: userOrgId,
                    application_id: slotData.application_id,
                    event_type: "OCR_QUEUED",
                    occurred_at: new Date().toISOString(),
                    actor_user_id: userData.user.id,
                    payload: {
                        extractionId: extraction.id,
                        slotId,
                        documentFileId,
                        profileKey: extractionProfile,
                    },
                });
            }
        }

        // =========================================================================
        // 8. Create signed URL and build response
        // =========================================================================
        let previewUrl = "";
        try {
            const { data: signedData } = await supabase.storage
                .from(BUCKET)
                .createSignedUrl(fileData.storage_path, SIGNED_URL_TTL_SECONDS);
            previewUrl = signedData?.signedUrl || "";
        } catch {
            previewUrl = "";
        }

        const def = slotData.slot_definitions as {
            label: string;
            group_name: string | null;
            help_text: string | null;
            scope: string;
        } | null;

        const slot: SlotWithDocument = {
            id: slotData.id,
            definitionId: slotData.slot_definition_id,
            label: def?.label || slotData.slot_definition_id,
            group: def?.group_name || "Other",
            scope: (def?.scope || "PRINCIPAL") as SlotScope,
            required: slotData.is_required,
            state: "uploaded" as SlotState,
            document: {
                id: fileData.id,
                fileName: fileData.file_name,
                fileSize: fileData.file_size || 0,
                mimeType: fileData.mime_type,
                previewUrl,
                uploadedAt: fileData.created_at,
                uploadedBy: fileData.uploaded_by,
            },
        };

        const response: AttachFileResponse = {
            success: true,
            slot,
        };

        return jsonResponse(response);
    } catch (error: any) {
        console.error("attach-file error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
