import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type ChatMessage = {
    role: 'user' | 'assistant';
    text: string;
};

type ChatRequest = {
    messages: ChatMessage[];
    systemPrompt?: string;
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = "gemini-1.5-flash";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const jsonResponse = (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant for an immigration case management platform. You help users navigate the system, understand immigration processes, and provide guidance on:

- Creating and managing applications (work permits, study permits, visitor visas, etc.)
- Managing applicants and their information
- Uploading and organizing documents
- Understanding cohorts and employer management
- Compliance and audit requirements
- General immigration questions for Canada

Key features of this platform:
- Dashboard: Overview of active cases, cohorts, and compliance alerts
- Applicants: Manage client information and create new applications
- Cohorts: Group workers by employer and job position for LMIA processing
- Employers: Manage employer records for work permit applications
- Documents: Upload and track required documents for each application
- Risk Center: Monitor compliance alerts and deadlines

Be helpful, concise, and professional. If you don't know something specific about the user's case, guide them to the appropriate section of the app or suggest they consult with an immigration professional.`;

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!GEMINI_API_KEY) {
            return jsonResponse({ error: "Gemini API key not configured" }, 500);
        }

        const body: ChatRequest = await req.json();
        const { messages, systemPrompt } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return jsonResponse({ error: "Messages array is required" }, 400);
        }

        // Convert chat history to Gemini format
        const geminiContents = messages.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // Build the request body for Gemini
        const geminiRequest = {
            contents: geminiContents,
            systemInstruction: {
                parts: [{ text: systemPrompt || DEFAULT_SYSTEM_PROMPT }]
            },
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(geminiRequest)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API error:", errorBody);
            return jsonResponse({ error: "Failed to get response from AI" }, 500);
        }

        const geminiData = await geminiResponse.json();

        // Extract the response text
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!responseText) {
            console.error("No response text from Gemini:", JSON.stringify(geminiData));
            return jsonResponse({ error: "Empty response from AI" }, 500);
        }

        return jsonResponse({
            reply: responseText,
            usage: {
                promptTokens: geminiData.usageMetadata?.promptTokenCount,
                responseTokens: geminiData.usageMetadata?.candidatesTokenCount,
                totalTokens: geminiData.usageMetadata?.totalTokenCount
            }
        });

    } catch (error: any) {
        console.error("Chat function error:", error);
        return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
    }
});
