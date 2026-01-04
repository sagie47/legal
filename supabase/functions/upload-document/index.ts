// supabase/functions/upload-document/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateDocuments } from "../_shared/documentEvaluator.ts";
import { WORK_PERMIT_IMM1295_CONFIG } from "../_shared/config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW_ANON_UPLOAD = Deno.env.get("ALLOW_ANON_DOCUMENT_UPLOAD") === "true";
const BUCKET = "documents";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg"
];

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

function makeSupabaseUser(authHeader: string) {
    return createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1) Auth (allow opt-out in dev via env flag)
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        let userOrgId: string | undefined;
        let userId: string | null = null;

        if (token) {
            const supabaseUser = makeSupabaseUser(authHeader);
            const { data: { user }, error: userError } = await supabaseUser.auth.getUser();

            // RELAXED CHECK: If token invalid but ANON upload allowed, proceed as anon
            if ((userError || !user) && !ALLOW_ANON_UPLOAD) {
                return new Response(JSON.stringify({ error: "Invalid user" }), {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (user) {
                userId = user.id;
                userOrgId = (user.user_metadata as any)?.org_id;
                if (!userOrgId) {
                    const { data: userRecord } = await supabaseAdmin
                        .from('users')
                        .select('org_id')
                        .eq('id', user.id)
                        .single();

                    if (userRecord) {
                        userOrgId = userRecord.org_id;
                    }
                }
            }
        } else if (!ALLOW_ANON_UPLOAD) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // 2) Parse form-data
        const formDataPayload = await req.formData();
        const applicationId = formDataPayload.get("applicationId")?.toString();
        const slotId = formDataPayload.get("slotId")?.toString();
        const file = formDataPayload.get("file") as File | null;

        if (!applicationId || !slotId || !file) {
            return new Response(
                JSON.stringify({ error: "Missing applicationId, slotId, or file" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        // 3) Validate application & org ownership
        const { data: app, error: appError } = await supabaseAdmin
            .from("applications")
            .select("id, org_id, applicant_id, type, details")
            .eq("id", applicationId)
            .single();

        if (appError || !app) {
            return new Response(JSON.stringify({ error: "Application not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Fallback: if no org resolved (common in dev) trust the application's org
        if (!userOrgId) {
            userOrgId = app.org_id;
        }

        if (userOrgId && app.org_id !== userOrgId) {
            return new Response(JSON.stringify({ error: "Forbidden: Application does not belong to your organization" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 4) Fetch Fact Data for Validation
        // We need to construct the 'formData' expected by evaluateDocuments
        // This involves fetching the Applicant and their details (family, history, etc.)
        const { data: applicant, error: applicantError } = await supabaseAdmin
            .from("applicants")
            .select("*")
            .eq("id", app.applicant_id)
            .single();

        if (applicantError || !applicant) {
            return new Response(JSON.stringify({ error: "Applicant not found" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Fetch existing documents for slot status
        const { data: existingDocs, error: docsError } = await supabaseAdmin
            .from("documents")
            .select("*")
            .eq("application_id", applicationId)
            .eq("org_id", app.org_id);

        if (docsError) {
            return new Response(JSON.stringify({ error: "Error fetching existing documents" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // Construct Logic Form Data
        const documentsMap: any = {};
        existingDocs.forEach((doc: any) => {
            documentsMap[doc.slot_id] = {
                status: doc.status,
                fileId: doc.id
            };
        });

        const validationContext = {
            documents: documentsMap,
            // Map applicant JSON fields to simple keys expected by rules
            // Assuming the JSON structure matches the CaseFormData interface roughly
            spouseRelationType: applicant.family?.spouse?.relationType || 'none',
            spouseFamilyName: applicant.family?.spouse?.familyName,
            currentlyInCanada: !!app.details?.immigration?.currentlyInCanada,
            currentStatus: app.details?.immigration?.currentStatus,
            personalHistory: applicant.history || []
        };

        // 5) Run Rules Engine
        const groups = evaluateDocuments(validationContext, WORK_PERMIT_IMM1295_CONFIG);
        const allSlots = groups.flatMap(g => g.slots);
        const targetSlot = allSlots.find(s => s.id === slotId);

        if (!targetSlot) {
            return new Response(JSON.stringify({ error: `Invalid slotId: ${slotId} for this application type` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (targetSlot.status === 'locked') {
            return new Response(JSON.stringify({ error: `Slot is locked. ${targetSlot.lockMessage || ''}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 6) Validate file properties
        const mimeType = file.type || "application/octet-stream";
        const size = file.size;

        if (size > MAX_FILE_BYTES) {
            return new Response(JSON.stringify({ error: "File too large" }), { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const isAllowed = ALLOWED_MIME.some(type => mimeType.includes(type));
        if (!isAllowed) {
            return new Response(JSON.stringify({ error: "Unsupported file type" }), { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^\w-.]+/g, "_");
        const storagePath = `applications/${applicationId}/${slotId}/${timestamp}-${safeName}`;
        const previousStoragePath = (existingDocs || []).find((doc: any) => doc.slot_id === slotId)?.storage_path as string | undefined;

        // 7) Upload to storage
        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(storagePath, arrayBuffer, {
                contentType: mimeType,
                upsert: false,
            });

        if (uploadError) {
            console.error("Storage upload error:", uploadError);
            return new Response(JSON.stringify({ error: "Storage upload failed: " + uploadError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 8) Upsert document record (single active document per slot)
        const now = new Date().toISOString();
        const { data: doc, error: docError } = await supabaseAdmin
            .from("documents")
            .upsert(
                {
                    org_id: userOrgId,
                    application_id: applicationId,
                    slot_id: slotId,
                    file_name: file.name,
                    storage_path: storagePath,
                    file_size: size,
                    mime_type: mimeType,
                    status: "uploaded",
                    uploaded_by: userId,
                    updated_at: now
                },
                { onConflict: "org_id,application_id,slot_id" }
            )
            .select()
            .single();

        if (docError || !doc) {
            console.error("DB upsert error:", docError);
            return new Response(JSON.stringify({ error: "DB upsert failed: " + docError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (previousStoragePath && previousStoragePath !== storagePath) {
            const { error: removeError } = await supabaseAdmin.storage
                .from(BUCKET)
                .remove([previousStoragePath]);
            if (removeError) {
                console.warn("Failed to delete previous storage object:", removeError);
            }
        }

        // 9) Generate Signed URL
        const { data: signed } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, 60 * 10); // 10 minutes

        const slotPayload = {
            slotId,
            status: "uploaded",
            document: {
                id: doc.id,
                fileName: doc.file_name,
                mimeType: doc.mime_type,
                size: doc.file_size,
                uploadedAt: doc.updated_at || doc.created_at,
                previewUrl: signed?.signedUrl ?? null,
            },
        };

        return new Response(JSON.stringify(slotPayload), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (e: any) {
        console.error("Unexpected error:", e);
        return new Response(JSON.stringify({ error: "Unexpected error: " + (e.message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
});
