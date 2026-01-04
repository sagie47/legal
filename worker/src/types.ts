/**
 * Types for OCR Extraction Worker
 */

export interface ExtractionJob {
    id: string;
    org_id: string;
    application_id: string;
    person_id: string | null;
    slot_id: string | null;
    document_file_id: string;
    provider: string;
    profile_key: string;
    engine_version: string;
    idempotency_key: string;
    status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
    attempt_count: number;
    next_attempt_at: string | null;
    started_at: string | null;
    finished_at: string | null;
    error_code: string | null;
    error_message: string | null;
    raw_json: unknown | null;
    text_content: string | null;
    pages_json: unknown | null;
    extracted_fields_json: Record<string, unknown> | null;
    raw_json_expires_at: string | null;
    scrubbed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExtractionResult {
    rawResponse: unknown;
    textContent: string;
    pagesJson: PageInfo[];
    extractedFields: Record<string, ExtractedField>;
}

export interface PageInfo {
    pageIndex: number;
    width: number;
    height: number;
    blocks: BlockInfo[];
}

export interface BlockInfo {
    text: string;
    confidence: number;
    bbox: BoundingBox;
}

export interface BoundingBox {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export interface ExtractedField {
    key: string;
    value: string;
    confidence: number;
    anchor: {
        pageIndex: number;
        bbox: BoundingBox;
        snippet: string;
    } | null;
    normalized?: unknown; // Normalized value (date, number, etc.)
}

// Extraction profile configuration
export interface ExtractionProfile {
    key: string;
    name: string;
    fields: ProfileFieldConfig[];
    targetEntity: 'person' | 'person_status' | 'work_permit_attributes' | 'study_permit_attributes' | 'employer';
}

export interface ProfileFieldConfig {
    fieldKey: string;
    fieldPath: string;
    patterns: RegExp[];
    type: 'string' | 'date' | 'number';
    severity: 'low' | 'medium' | 'high';
    required?: boolean;
}
