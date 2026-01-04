// Form Visibility Configuration
// Defines which tabs and fields are visible/required for each application type

export interface FormVisibilityConfig {
    tabs: string[];
    requiredFields: string[];
    showStatusInCanada: boolean;
}

export const FORM_VISIBILITY: Record<string, FormVisibilityConfig> = {
    'Study Permit Outside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'eduLevel', 'nativeLanguage'],
        showStatusInCanada: false
    },
    'Study Permit Inside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'eduLevel', 'nativeLanguage', 'currentlyInCanada'],
        showStatusInCanada: true
    },
    'Work Permit Outside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'jobTitle', 'nativeLanguage'],
        showStatusInCanada: false
    },
    'Work Permit Inside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'jobTitle', 'nativeLanguage', 'currentlyInCanada'],
        showStatusInCanada: true
    },
    'Work Permit - LMIA Exempt (C16)': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'jobTitle'],
        showStatusInCanada: true
    },
    'Work Permit - LMIA Based': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'jobTitle', 'employerName'],
        showStatusInCanada: true
    },
    'Visitor Visa Outside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum'],
        showStatusInCanada: false
    },
    'Visitor Visa Inside Canada': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'currentlyInCanada'],
        showStatusInCanada: true
    },
    'Humanitarian and Compassionate': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'currentlyInCanada'],
        showStatusInCanada: true
    },
    'Spousal Sponsorship': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'spouseRelationType'],
        showStatusInCanada: true
    },
    'Express Entry': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex', 'passportNum', 'eduLevel', 'nativeLanguage', 'languageTestTaken'],
        showStatusInCanada: false
    },
    'General': {
        tabs: ['universal', 'passport', 'education', 'employment', 'family', 'background', 'immigration'],
        requiredFields: ['familyName', 'givenNames', 'dob', 'sex'],
        showStatusInCanada: true
    }
};

// Get visibility config for a given application type
export const getFormVisibility = (appType: string): FormVisibilityConfig => {
    return FORM_VISIBILITY[appType] || FORM_VISIBILITY['General'];
};

// Check if a tab should be visible for a given application type
export const isTabVisible = (appType: string, tabId: string): boolean => {
    const config = getFormVisibility(appType);
    return config.tabs.includes(tabId);
};

// Check if a field is required for a given application type
export const isFieldRequired = (appType: string, fieldName: string): boolean => {
    const config = getFormVisibility(appType);
    return config.requiredFields.includes(fieldName);
};
