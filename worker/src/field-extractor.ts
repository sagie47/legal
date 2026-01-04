/**
 * Field Extractor
 * 
 * Extracts normalized fields from OCR text based on extraction profiles.
 * Handles passport_v1, wp_current_permit_v1, sp_current_permit_v1, and sp_loa_v1 profiles.
 */

import { ExtractedField, PageInfo } from './types';

// =============================================================================
// EXTRACTION PROFILES
// =============================================================================

interface FieldPattern {
    key: string;
    fieldPath: string;
    patterns: RegExp[];
    type: 'string' | 'date' | 'number';
    severity: 'low' | 'medium' | 'high';
    targetEntity: 'person' | 'person_status' | 'work_permit_attributes' | 'study_permit_attributes' | 'employer';
}

const PASSPORT_V1_FIELDS: FieldPattern[] = [
    {
        key: 'person.passport.number',
        fieldPath: 'passport.number',
        patterns: [
            /passport\s*(?:no\.?|number|#|num\.?)[:\s]*([A-Z0-9]{6,12})/i,
            /(?:^|\s)([A-Z]{2}[0-9]{6,9})(?:\s|$)/,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'person',
    },
    {
        key: 'person.identity.familyName',
        fieldPath: 'identity.familyName',
        patterns: [
            /(?:surname|family\s*name)[:\s]*([A-Z][A-Z\s'-]+)/i,
            /(?:^|\n)([A-Z][A-Z'-]+)\s*(?:\n|,)/,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'person',
    },
    {
        key: 'person.identity.givenNames',
        fieldPath: 'identity.givenNames',
        patterns: [
            /(?:given\s*names?|first\s*names?|prénoms?)[:\s]*([A-Z][A-Za-z\s'-]+)/i,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'person',
    },
    {
        key: 'person.identity.dob',
        fieldPath: 'identity.dob',
        patterns: [
            /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date|née?\s*le)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:date\s*of\s*birth|d\.?o\.?b\.?)[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:date\s*of\s*birth|d\.?o\.?b\.?)[:\s]*(\d{2}[\s/.-]\d{2}[\s/.-]\d{4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'person',
    },
    {
        key: 'person.identity.sex',
        fieldPath: 'identity.sex',
        patterns: [
            /(?:sex|gender)[:\s]*(M|F|MALE|FEMALE|X)/i,
        ],
        type: 'string',
        severity: 'low',
        targetEntity: 'person',
    },
    {
        key: 'person.passport.country',
        fieldPath: 'passport.country',
        patterns: [
            /(?:nationality|citizenship|country)[:\s]*([A-Z]{3})/i,
            /(?:code\s*of\s*issuing\s*state)[:\s]*([A-Z]{3})/i,
        ],
        type: 'string',
        severity: 'medium',
        targetEntity: 'person',
    },
    {
        key: 'person.passport.expiryDate',
        fieldPath: 'passport.expiryDate',
        patterns: [
            /(?:date\s*of\s*expiry|expires?|expiration|valid\s*until)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:date\s*of\s*expiry|expires?)[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:date\s*of\s*expiry|expires?)[:\s]*(\d{2}[\s/.-]\d{2}[\s/.-]\d{4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'person',
    },
];

const WP_CURRENT_PERMIT_V1_FIELDS: FieldPattern[] = [
    {
        key: 'person_status.validTo',
        fieldPath: 'validTo',
        patterns: [
            /(?:valid\s*until|expires?|expiry|expiration)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:valid\s*until|expires?)[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:authorized\s*to\s*work\s*until)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'person_status',
    },
    {
        key: 'work_permit_attributes.insideCanadaContext.currentStatusExpiresAt',
        fieldPath: 'insideCanadaContext.currentStatusExpiresAt',
        patterns: [
            /(?:valid\s*until|expires?)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'work_permit_attributes',
    },
];

const SP_CURRENT_PERMIT_V1_FIELDS: FieldPattern[] = [
    {
        key: 'person_status.validTo',
        fieldPath: 'validTo',
        patterns: [
            /(?:valid\s*until|expires?|expiry|expiration)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:valid\s*until|expires?)[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:authorized\s*to\s*study\s*until)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'person_status',
    },
    {
        key: 'study_permit_attributes.insideCanadaContext.currentStatusExpiresAt',
        fieldPath: 'insideCanadaContext.currentStatusExpiresAt',
        patterns: [
            /(?:valid\s*until|expires?)[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
];

const SP_LOA_V1_FIELDS: FieldPattern[] = [
    {
        key: 'study_permit_attributes.program.dliNumber',
        fieldPath: 'program.dliNumber',
        patterns: [
            /(?:dli|designated\s+learning\s+institution)\s*(?:number|no\.?|#)[:\s]*([A-Z0-9]{8,15})/i,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.institutionName',
        fieldPath: 'program.institutionName',
        patterns: [
            /(?:institution|school|college|university)\s*name[:\s]*([A-Za-z0-9 ,.'&-]{3,})/i,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.campusCity',
        fieldPath: 'program.campusCity',
        patterns: [
            /(?:campus|location|city)[:\s]*([A-Za-z .'-]{2,})/i,
        ],
        type: 'string',
        severity: 'medium',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.credentialLevel',
        fieldPath: 'program.credentialLevel',
        patterns: [
            /(?:credential|program\s*level|level)[:\s]*([A-Za-z0-9 ,.'&-]{3,})/i,
        ],
        type: 'string',
        severity: 'medium',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.programName',
        fieldPath: 'program.programName',
        patterns: [
            /(?:program|programme|course)\s*(?:name)?[:\s]*([A-Za-z0-9 ,.'&-]{3,})/i,
        ],
        type: 'string',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.startDate',
        fieldPath: 'program.startDate',
        patterns: [
            /(?:program|course)?\s*start\s*date[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:program|course)?\s*start\s*date[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:program|course)?\s*start\s*date[:\s]*(\d{2}[\s/.-]\d{2}[\s/.-]\d{4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.endDate',
        fieldPath: 'program.endDate',
        patterns: [
            /(?:program|course)?\s*(?:end|completion)\s*date[:\s]*(\d{1,2}[\s/.-]\w{3,9}[\s/.-]\d{2,4})/i,
            /(?:program|course)?\s*(?:end|completion)\s*date[:\s]*(\d{4}[\s/.-]\d{2}[\s/.-]\d{2})/i,
            /(?:program|course)?\s*(?:end|completion)\s*date[:\s]*(\d{2}[\s/.-]\d{2}[\s/.-]\d{4})/i,
        ],
        type: 'date',
        severity: 'high',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.tuitionFirstYear',
        fieldPath: 'program.tuitionFirstYear',
        patterns: [
            /(?:tuition|fees)\s*(?:for\s*first\s*year|year\s*1)?[:\s]*([$]?\s?[\d,]+(?:\.\d{2})?)/i,
        ],
        type: 'number',
        severity: 'medium',
        targetEntity: 'study_permit_attributes',
    },
    {
        key: 'study_permit_attributes.program.deliveryMode',
        fieldPath: 'program.deliveryMode',
        patterns: [
            /(?:delivery|instruction|mode)[:\s]*([A-Za-z -]{3,})/i,
        ],
        type: 'string',
        severity: 'low',
        targetEntity: 'study_permit_attributes',
    },
];

const PROFILES: Record<string, FieldPattern[]> = {
    passport_v1: PASSPORT_V1_FIELDS,
    wp_current_permit_v1: WP_CURRENT_PERMIT_V1_FIELDS,
    sp_current_permit_v1: SP_CURRENT_PERMIT_V1_FIELDS,
    sp_loa_v1: SP_LOA_V1_FIELDS,
};

// =============================================================================
// MAIN EXTRACTION FUNCTION
// =============================================================================

export function extractFieldsFromText(
    text: string,
    profileKey: string,
    pages: PageInfo[]
): Record<string, ExtractedField> {
    const fields = PROFILES[profileKey];
    if (!fields) {
        console.warn(`Unknown profile: ${profileKey}`);
        return {};
    }

    const result: Record<string, ExtractedField> = {};

    for (const field of fields) {
        const extracted = extractField(text, field, pages);
        if (extracted) {
            result[field.key] = extracted;
        }
    }

    return result;
}

// =============================================================================
// FIELD EXTRACTION
// =============================================================================

function extractField(
    text: string,
    field: FieldPattern,
    pages: PageInfo[]
): ExtractedField | null {
    for (const pattern of field.patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const rawValue = match[1].trim();
            const normalized = normalizeValue(rawValue, field.type);

            // Find anchor (approximate location in pages)
            const anchor = findAnchor(text, match[0], pages);

            return {
                key: field.key,
                value: rawValue,
                confidence: 0.85, // Base confidence, could be refined
                anchor,
                normalized,
            };
        }
    }

    return null;
}

// =============================================================================
// VALUE NORMALIZATION
// =============================================================================

function normalizeValue(value: string, type: 'string' | 'date' | 'number'): unknown {
    switch (type) {
        case 'date':
            return parseDate(value);
        case 'number':
            return parseFloat(value.replace(/[^\d.]/g, ''));
        case 'string':
        default:
            return value.toUpperCase();
    }
}

function parseDate(dateStr: string): string | null {
    // Common date formats in passports/permits
    const formats = [
        // 01 JAN 2025
        /^(\d{1,2})\s*([A-Za-z]{3,9})\s*(\d{2,4})$/,
        // 2025-01-15
        /^(\d{4})-(\d{2})-(\d{2})$/,
        // 01/15/2025 or 15/01/2025
        /^(\d{2})\/(\d{2})\/(\d{4})$/,
        // 01-15-2025
        /^(\d{2})-(\d{2})-(\d{4})$/,
    ];

    const monthNames: Record<string, string> = {
        jan: '01', january: '01',
        feb: '02', february: '02',
        mar: '03', march: '03',
        apr: '04', april: '04',
        may: '05',
        jun: '06', june: '06',
        jul: '07', july: '07',
        aug: '08', august: '08',
        sep: '09', sept: '09', september: '09',
        oct: '10', october: '10',
        nov: '11', november: '11',
        dec: '12', december: '12',
    };

    const normalized = dateStr.replace(/[\s/.-]+/g, ' ').trim().toLowerCase();

    // Try 01 JAN 2025 format
    const alphaMatch = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{2,4})$/);
    if (alphaMatch) {
        const day = alphaMatch[1].padStart(2, '0');
        const month = monthNames[alphaMatch[2]] || alphaMatch[2];
        let year = alphaMatch[3];
        if (year.length === 2) {
            year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
        }
        return `${year}-${month}-${day}`;
    }

    // Try YYYY-MM-DD
    const isoMatch = normalized.match(/^(\d{4})\s+(\d{2})\s+(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // Try DD/MM/YYYY or MM/DD/YYYY (assume DD/MM for passport dates)
    const slashMatch = normalized.match(/^(\d{2})\s+(\d{2})\s+(\d{4})$/);
    if (slashMatch) {
        // Assume DD/MM/YYYY for international documents
        return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
    }

    return null;
}

// =============================================================================
// ANCHOR FINDING
// =============================================================================

function findAnchor(
    fullText: string,
    matchedText: string,
    pages: PageInfo[]
): { pageIndex: number; bbox: { x0: number; y0: number; x1: number; y1: number }; snippet: string } | null {
    // Find the character position in full text
    const position = fullText.indexOf(matchedText);
    if (position === -1) {
        return null;
    }

    // Approximate which block contains this text
    let charCount = 0;
    for (const page of pages) {
        for (const block of page.blocks) {
            if (block.text.includes(matchedText.substring(0, 20))) {
                return {
                    pageIndex: page.pageIndex,
                    bbox: block.bbox,
                    snippet: matchedText.substring(0, 50),
                };
            }
            charCount += block.text.length;
        }
    }

    // Fallback: first page, no bbox
    return {
        pageIndex: 0,
        bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
        snippet: matchedText.substring(0, 50),
    };
}
