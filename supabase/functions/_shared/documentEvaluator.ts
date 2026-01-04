
export interface DocumentSlot {
    id: string;
    label: string;
    group: string;
    required: boolean;
    role: 'applicant' | 'spouse' | 'employer' | 'child';
    documentType: string;
    status: 'missing' | 'locked' | 'uploaded' | 'in_review' | 'verified' | 'rejected';
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    uploadedBy?: string;
    lockMessage?: string;
    rejectionReason?: string;
    expiryDate?: string;
}

export interface DocumentGroup {
    id: string;
    title: string;
    slots: DocumentSlot[];
}

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

/**
 * PURE LOGIC FUNCTION
 * Evaluates the rules against the provided data to produce a list of actual UI slots.
 */
export const evaluateDocuments = (
    formData: any,
    config: ApplicationConfig
): DocumentGroup[] => {

    // Helper: Verify a single condition
    const checkCondition = (condition?: RuleCondition): boolean => {
        if (!condition) return true; // No rule = pass

        const fieldValue = get(formData, condition.field);

        switch (condition.operator) {
            case 'eq': return fieldValue === condition.value;
            case 'neq': return fieldValue !== condition.value;
            case 'exists': return fieldValue !== undefined && fieldValue !== '' && fieldValue !== null;
            case 'contains': return Array.isArray(fieldValue) && fieldValue.includes(condition.value);
            case 'gt': return Number(fieldValue) > Number(condition.value);
            default: return false;
        }
    };

    // Helper: Deep get for nested fields if needed (simple implementation)
    const get = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    return config.groups.map(groupConfig => {
        let computedSlots: DocumentSlot[] = [];

        // 1. Process Static Slots
        if (groupConfig.slots) {
            groupConfig.slots.forEach(slotConfig => {
                // Check Visibility
                const isVisible = checkCondition(slotConfig.visibilityRule);
                if (!isVisible) return; // Skip this slot completely

                // Check Locking
                const isUnlocked = checkCondition(slotConfig.unlockRule);

                // Get existing file state if any
                const fileState = formData.documents?.[slotConfig.id];

                computedSlots.push({
                    id: slotConfig.id,
                    label: slotConfig.label,
                    group: groupConfig.id,
                    required: slotConfig.required,
                    role: slotConfig.role,
                    documentType: slotConfig.documentType,
                    // If file exists, use its status. Else if locked, 'locked'. Else 'missing'.
                    status: fileState ? fileState.status : (isUnlocked ? 'missing' : 'locked'),
                    lockMessage: isUnlocked ? undefined : slotConfig.lockMessage,
                    // Map file metadata
                    fileId: fileState?.fileId,
                    fileName: fileState?.fileName,
                    fileSize: fileState?.fileSize,
                    uploadedAt: fileState?.uploadedAt,
                    uploadedBy: fileState?.uploadedBy,
                    rejectionReason: fileState?.rejectionReason
                });
            });
        }

        // 2. Process Generators
        if (groupConfig.generator) {
            if (groupConfig.generator.type === 'residence_history_countries') {
                const history = formData.personalHistory || [];
                const countries = new Set<string>();

                // Extract unique countries from history entries (excluding current if needed, but let's simple it first)
                history.forEach((entry: any) => {
                    if (entry.country && entry.country !== 'Canada') { // Assuming Canada doesn't need police cert for this flow usually
                        countries.add(entry.country);
                    }
                });

                countries.forEach(countryName => {
                    const template = groupConfig.generator!.template;
                    const slotId = template.id.replace('{country_code}', countryName.toLowerCase().replace(/\s/g, '_'));
                    const fileState = formData.documents?.[slotId];

                    computedSlots.push({
                        id: slotId,
                        label: template.label.replace('{country_name}', countryName),
                        group: groupConfig.id,
                        required: template.required,
                        role: template.role,
                        documentType: template.documentType,
                        status: fileState ? fileState.status : 'missing',
                        // Map file metadata
                        fileId: fileState?.fileId,
                        fileName: fileState?.fileName,
                        fileSize: fileState?.fileSize,
                        uploadedAt: fileState?.uploadedAt,
                        uploadedBy: fileState?.uploadedBy,
                        rejectionReason: fileState?.rejectionReason
                    });
                });
            }
        }

        return {
            id: groupConfig.id,
            title: groupConfig.title,
            slots: computedSlots
        };
    }).filter(group => group.slots.length > 0); // Only return groups that have visible slots
};
