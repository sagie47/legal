import { readFile } from 'fs/promises';

export type ConditionOperator = 'eq' | 'neq' | 'exists';

export type RuleCondition = {
    field: string;
    operator: ConditionOperator;
    value?: any;
};

export type DocumentSlotConfig = {
    id: string;
    label: string;
    role: 'applicant' | 'spouse' | 'child' | 'employer';
    document_type: string;
    required: boolean;
    condition?: RuleCondition | null;
    lock_message?: string | null;
};

export type DocumentGroupConfig = {
    id: string;
    title: string;
    slots?: DocumentSlotConfig[];
    // Generator support can be added later (e.g. police certs per country)
};

export type DocumentRulesConfig = {
    application_type: string;
    groups: DocumentGroupConfig[];
};

const CONFIG_PATHS: Record<string, string> = {
    'Work Permit Outside Canada': new URL('./work_permit_outside_imm1295.json', import.meta.url).pathname
};

export async function loadDocumentRules(applicationType: string): Promise<DocumentRulesConfig | null> {
    const normalizedType = applicationType.trim();
    const configPath = CONFIG_PATHS[normalizedType];

    if (!configPath) return null;

    const raw = await readFile(configPath, 'utf-8');
    return JSON.parse(raw) as DocumentRulesConfig;
}
