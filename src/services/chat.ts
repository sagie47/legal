import { supabase } from '../lib/supabase';

export type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    createdAt: number;
};

export type ChatRequest = {
    messages: { role: 'user' | 'assistant'; text: string }[];
    systemPrompt?: string;
};

export type ChatResponse = {
    reply: string;
    usage?: {
        promptTokens?: number;
        responseTokens?: number;
        totalTokens?: number;
    };
};

const getFunctionBaseUrl = () => {
    const envUrl = import.meta.env.VITE_SUPABASE_FUNCTION_URL;
    if (envUrl) return envUrl;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl) return `${supabaseUrl}/functions/v1`;

    return 'http://localhost:54321/functions/v1';
};

/**
 * Send a message to the AI chatbot and get a response
 */
export async function sendChatMessage(
    messages: { role: 'user' | 'assistant'; text: string }[],
    systemPrompt?: string
): Promise<ChatResponse> {
    const { data: { session } } = await supabase.auth.getSession();

    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${getFunctionBaseUrl()}/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
            messages,
            systemPrompt
        } as ChatRequest)
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || 'Failed to get chat response');
    }

    return response.json();
}

/**
 * Create a unique message ID
 */
export function createMessageId(prefix: 'user' | 'assistant'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new user message object
 */
export function createUserMessage(text: string): ChatMessage {
    return {
        id: createMessageId('user'),
        role: 'user',
        text,
        createdAt: Date.now()
    };
}

/**
 * Create a new assistant message object
 */
export function createAssistantMessage(text: string): ChatMessage {
    return {
        id: createMessageId('assistant'),
        role: 'assistant',
        text,
        createdAt: Date.now()
    };
}
