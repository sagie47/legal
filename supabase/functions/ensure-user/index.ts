import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
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

        const user = userData.user;
        const { data: existing, error: existingError } = await supabase
            .from("users")
            .select("id, email, display_name, org_id, role")
            .eq("id", user.id)
            .maybeSingle();

        if (existingError) {
            console.error("ensure-user: failed to read profile:", existingError);
            return jsonResponse({ error: "Profile lookup failed" }, 500);
        }

        if (existing) {
            return jsonResponse({ status: "exists", profile: existing });
        }

        if (!user.email) {
            return jsonResponse({ error: "User email missing" }, 400);
        }

        const metadata = (user.user_metadata || {}) as Record<string, unknown>;
        const metadataOrgId = typeof metadata.org_id === "string" ? metadata.org_id : "";
        const orgId = isUuid(metadataOrgId) ? metadataOrgId : DEFAULT_ORG_ID;
        const displayName =
            (typeof metadata.display_name === "string" && metadata.display_name) ||
            (typeof metadata.full_name === "string" && metadata.full_name) ||
            (user.email ? user.email.split("@")[0] : null);

        if (orgId === DEFAULT_ORG_ID) {
            await supabase
                .from("organizations")
                .upsert({ id: DEFAULT_ORG_ID, name: "Default Organization" }, { onConflict: "id" });
        }

        const { data: inserted, error: insertError } = await supabase
            .from("users")
            .insert({
                id: user.id,
                email: user.email,
                display_name: displayName,
                org_id: orgId,
                role: "user",
            })
            .select()
            .single();

        if (insertError || !inserted) {
            console.error("ensure-user: insert failed:", insertError);
            return jsonResponse({ error: "Profile insert failed" }, 500);
        }

        return jsonResponse({ status: "created", profile: inserted });
    } catch (error: any) {
        console.error("ensure-user error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
