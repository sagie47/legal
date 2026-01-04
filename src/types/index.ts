// Shared Type Definitions

export interface Client {
    id: number;
    name: string;
    email: string;
    created: string;
}

export interface Case {
    id: number;
    client: Client;
    appType: string;
    status: string;
    lastUpdated: string;
}

export const APPLICATION_STREAMS = [
    "Humanitarian and Compassionate",
    "Spousal Sponsorship",
    "Express Entry",
    "Study Permit Outside Canada",
    "Work Permit Outside Canada",
    "Visitor Visa Outside Canada",
    "Study Permit Inside Canada",
    "Work Permit Inside Canada",
    "Visitor Visa Inside Canada",
    "Work Permit - LMIA Exempt (C16)",
    "Work Permit - LMIA Based",
    "General"
] as const;

export type ApplicationStream = typeof APPLICATION_STREAMS[number];
