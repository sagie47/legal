import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { evaluateDocuments } from "../_shared/documentEvaluator.ts";
import { WORK_PERMIT_IMM1295_CONFIG } from "../_shared/config.ts";

type DocumentRow = {
    id: string;
    org_id: string;
    application_id: string;
    slot_id: string;
    status: string;
    storage_path: string;
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    uploaded_by: string | null;
    created_at: string;
    updated_at: string;
    metadata?: any;
};

type ApplicantRow = {
    id: string;
    org_id: string;
    identity?: any;
    family?: any;
    history?: any;
    meta?: any;
};

type ApplicationRow = {
    id: string;
    org_id: string;
    applicant_id: string;
    type: string;
    details?: any;
};

type CaseFacts = {
    orgId: string;
    applicationId: string;
    applicationType: string;
    applicant: {
        id: string;
        fullName: string;
        maritalStatus?: string;
        hasSpouse: boolean;
        hasChildren: boolean;
        uci?: string;
    };
    statusInCanada: {
        isInCanada: boolean;
        currentStatus?: string;
        originalEntryDate?: string;
    };
    family: {
        spouseExists: boolean;
        childrenCount: number;
    };
    residenceHistory: {
        countriesLast5Years: string[];
        countriesRequiringPoliceCert: string[];
    };
};

type DocumentFileMeta = {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string | null;
    previewUrl?: string | null;
    uploadedAt: string;
    uploadedByUserId: string | null;
    status: "missing" | "uploaded" | "in_review" | "verified" | "rejected";
};

type DocumentSlotResult = {
    id: string;
    groupId: string;
    label: string;
    role: "applicant" | "spouse" | "child" | "employer";
    documentType: string;
    required: boolean;
    visible: boolean;
    locked: boolean;
    lockMessage?: string | null;
    status: "missing" | "uploaded" | "in_review" | "verified" | "rejected";
    documents: DocumentFileMeta[];
};

type DocumentGroupResult = {
    id: string;
    title: string;
    slots: DocumentSlotResult[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALLOW_ANON = Deno.env.get("ALLOW_ANON_DOCUMENT_SLOTS") === "true";
const BUCKET = "documents";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const jsonResponse = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

const normalizeArray = <T>(value: T[] | T | null | undefined): T[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const buildFacts = (application: ApplicationRow, applicant: ApplicantRow, orgId: string): CaseFacts => {
    const identity = (applicant.identity || {}) as Record<string, any>;
    const family = (applicant.family || {}) as Record<string, any>;
    const history = normalizeArray<Record<string, any>>(applicant.history as any);
    const details = (application.details || {}) as Record<string, any>;

    const spouseExists = !!family?.spouse;
    const childrenCount = normalizeArray(family?.children).length;

    const countries = Array.from(
        new Set(
            history
                .map(entry => entry?.country)
                .filter((c): c is string => !!c && c.trim().length > 0)
        )
    );

    const applicationType = (application as any).applicationType || application.type || "Work Permit - Outside Canada (IMM 1295)";
    const fullName = [identity.familyName, identity.givenNames].filter(Boolean).join(", ") || "Unknown";

    return {
        orgId,
        applicationId: application.id,
        applicationType,
        applicant: {
            id: application.applicant_id,
            fullName,
            maritalStatus: identity.maritalStatus,
            hasSpouse: spouseExists,
            hasChildren: childrenCount > 0,
            uci: identity.uci
        },
        statusInCanada: {
            isInCanada: !!details?.immigration?.currentlyInCanada,
            currentStatus: details?.immigration?.currentStatus,
            originalEntryDate: details?.immigration?.originalEntryDate
        },
        family: {
            spouseExists,
            childrenCount
        },
        residenceHistory: {
            countriesLast5Years: countries,
            countriesRequiringPoliceCert: countries
        }
    };
};

const mapFileMeta = async (supabase: any, doc: DocumentRow): Promise<DocumentFileMeta> => {
    let previewUrl: string | null = null;
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS);
        if (!error) previewUrl = data?.signedUrl ?? null;
    } catch {
        previewUrl = null;
    }

    return {
        id: doc.id,
        fileName: doc.file_name,
        fileSize: doc.file_size || 0,
        mimeType: doc.mime_type || null,
        previewUrl,
        uploadedAt: doc.updated_at || doc.created_at || new Date().toISOString(),
        uploadedByUserId: doc.uploaded_by,
        status: (["uploaded", "in_review", "verified", "rejected"] as const).includes(doc.status as any)
            ? (doc.status as DocumentFileMeta["status"])
            : "uploaded"
    };
};

const deriveSlotStatus = (locked: boolean, files: DocumentFileMeta[]): DocumentSlotResult["status"] => {
    if (locked) return "missing";
    if (!files.length) return "missing";
    if (files.some(f => f.status === "verified")) return "verified";
    if (files.some(f => f.status === "rejected")) return "rejected";
    if (files.some(f => f.status === "in_review")) return "in_review";
    return "uploaded";
};

serve(async req => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { searchParams } = new URL(req.url);
        const applicationId = searchParams.get("applicationId");
        const orgId = searchParams.get("orgId");

        if (!applicationId || !orgId) {
            return jsonResponse({ error: "applicationId and orgId are required" }, 400);
        }

        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.replace("Bearer ", "").trim();

        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, token ? {
            global: { headers: { Authorization: `Bearer ${token}` } }
        } : undefined);

        let userOrgId: string | undefined;

        if (token) {
            const { data: userResult, error: userError } = await supabase.auth.getUser(token);
            const user = userResult?.user;
            if (userError || !user) {
                return jsonResponse({ error: "Invalid user" }, 401);
            }

            userOrgId = (user.user_metadata as any)?.org_id as string | undefined;
            if (!userOrgId) {
                const { data: userRow, error: userRowError } = await supabase
                    .from("users")
                    .select("org_id")
                    .eq("id", user.id)
                    .single();

                if (userRowError || !userRow) {
                    return jsonResponse({ error: "Could not determine user organization" }, 403);
                }
                userOrgId = userRow.org_id;
            }
        } else if (!ALLOW_ANON) {
            return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const { data: application, error: appError } = await supabase
            .from("applications")
            .select("id, org_id, applicant_id, type, details")
            .eq("id", applicationId)
            .single();

        if (appError || !application) {
            return jsonResponse({ error: "Application not found" }, 404);
        }

        if (orgId !== application.org_id) {
            return jsonResponse({ error: "orgId does not match application org" }, 400);
        }

        const effectiveOrgId = application.org_id;

        if (!userOrgId && ALLOW_ANON) {
            userOrgId = effectiveOrgId;
        }

        if (effectiveOrgId !== userOrgId) {
            return jsonResponse({ error: "Forbidden: application does not belong to org" }, 403);
        }

        const { data: applicant, error: applicantError } = await supabase
            .from("applicants")
            .select("id, org_id, identity, family, history, meta")
            .eq("id", application.applicant_id)
            .single();

        if (applicantError || !applicant) {
            return jsonResponse({ error: "Applicant not found" }, 404);
        }

        const { data: documents, error: docsError } = await supabase
            .from("documents")
            .select("*")
            .eq("application_id", applicationId)
            .eq("org_id", effectiveOrgId);

        if (docsError) {
            return jsonResponse({ error: "Failed to load documents" }, 500);
        }

        const docsBySlot = (documents || []).reduce<Record<string, DocumentRow[]>>((acc, doc) => {
            acc[doc.slot_id] = acc[doc.slot_id] || [];
            acc[doc.slot_id].push(doc);
            return acc;
        }, {});

        const logicFormData = {
            documents: Object.fromEntries(
                (documents || []).map(doc => [
                    doc.slot_id,
                    {
                        status: doc.status,
                        fileId: doc.id,
                        fileName: doc.file_name,
                        fileSize: doc.file_size,
                        uploadedAt: doc.updated_at || doc.created_at,
                        uploadedBy: doc.uploaded_by,
                        mimeType: doc.mime_type
                    }
                ])
            ),
            spouseRelationType: (applicant.family as any)?.spouse?.relationType || "none",
            spouseFamilyName: (applicant.family as any)?.spouse?.familyName,
            currentlyInCanada: !!(application.details as any)?.immigration?.currentlyInCanada,
            currentStatus: (application.details as any)?.immigration?.currentStatus,
            personalHistory: normalizeArray((applicant.history as any) || [])
        };

        const evaluated = evaluateDocuments(logicFormData, WORK_PERMIT_IMM1295_CONFIG);

        const groups: DocumentGroupResult[] = (await Promise.all(
            evaluated.map(async group => {
                const slots: DocumentSlotResult[] = await Promise.all(
                    group.slots.map(async slot => {
                        const existingDocs = docsBySlot[slot.id] || [];
                        const locked = slot.status === "locked";
                        const fileMetas = await Promise.all(existingDocs.map(doc => mapFileMeta(supabase, doc)));
                        const status = deriveSlotStatus(locked, fileMetas);

                        return {
                            id: slot.id,
                            groupId: group.id,
                            label: slot.label,
                            role: slot.role,
                            documentType: slot.documentType,
                            required: slot.required,
                            visible: true,
                            locked,
                            lockMessage: locked ? slot.lockMessage : null,
                            status,
                            documents: fileMetas
                        };
                    })
                );

                return {
                    id: group.id,
                    title: group.title,
                    slots
                };
            })
        )).filter(group => group.slots.length > 0);

        const facts = buildFacts(application as ApplicationRow, applicant as ApplicantRow, effectiveOrgId);

        return jsonResponse({ groups, facts });
    } catch (error: any) {
        console.error("document-slots error", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
