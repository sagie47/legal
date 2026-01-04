
import { DocumentSlot, SlotStatus } from '../features/documents';

export interface RuleCondition {
    field: string;
    operator: 'eq' | 'neq' | 'contains' | 'exists' | 'gt';
    value?: any;
}

export interface DocumentRuleConfig {
    id: string; // e.g., 'passport'
    label: string;
    required: boolean;
    role: 'applicant' | 'spouse' | 'employer' | 'child';
    documentType: string;

    // Logic Rules
    visibilityRule?: RuleCondition; // If false, slot is hidden
    unlockRule?: RuleCondition;     // If false, slot is visible but LOCKED
    lockMessage?: string;           // Message to show when locked
}

export interface DocumentGroupConfig {
    id: string;
    title: string;
    slots?: DocumentRuleConfig[];      // Static slots
    generator?: {                      // Dynamic slots
        type: 'residence_history_countries';
        template: DocumentRuleConfig;
    };
}

export interface ApplicationConfig {
    applicationType: string;
    groups: DocumentGroupConfig[];
}

// Work Permit (Outside Canada) - IMM 1295
export const WORK_PERMIT_IMM1295_CONFIG: ApplicationConfig = {
    applicationType: 'Work Permit - Outside Canada (IMM 1295)',
    groups: [
        {
            id: 'identity',
            title: 'Identity & Status',
            slots: [
                {
                    id: 'passport',
                    label: 'Passport (Applicant)',
                    required: true,
                    role: 'applicant',
                    documentType: 'passport'
                },
                {
                    id: 'photo',
                    label: 'Digital Photo (Applicant)',
                    required: true,
                    role: 'applicant',
                    documentType: 'photo'
                },
                {
                    id: 'status_doc',
                    label: 'Current Status Document',
                    required: true,
                    role: 'applicant',
                    documentType: 'status_doc',
                    visibilityRule: {
                        field: 'currentlyInCanada',
                        operator: 'eq',
                        value: true
                    },
                    unlockRule: {
                        field: 'currentStatus',
                        operator: 'exists'
                    },
                    lockMessage: "Select your specific status in the Immigration tab to unlock."
                }
            ]
        },
        {
            id: 'family',
            title: 'Family & Dependents',
            slots: [
                {
                    id: 'marriage_cert',
                    label: 'Marriage Certificate',
                    required: true,
                    role: 'spouse',
                    documentType: 'marriage_cert',
                    visibilityRule: {
                        field: 'spouseRelationType',
                        operator: 'neq',
                        value: 'none'
                    },
                    // Example: Only unlock when spouse name is filled
                    unlockRule: {
                        field: 'spouseFamilyName',
                        operator: 'exists'
                    },
                    lockMessage: "Enter spouse details in the Family tab to unlock."
                }
            ]
        },
        {
            id: 'background',
            title: 'Background & Police',
            generator: {
                type: 'residence_history_countries',
                template: {
                    id: 'police_cert_{country_code}', // Placeholder
                    label: 'Police Certificate – {country_name}',
                    required: true,
                    role: 'applicant',
                    documentType: 'police_certificate'
                }
            }
        }
    ]
};
