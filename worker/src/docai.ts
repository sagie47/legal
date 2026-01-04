/**
 * Document AI Client
 * 
 * Calls Google Document AI for OCR processing with optimized config
 * for English passport/permit documents.
 */

import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ExtractionResult, PageInfo, BlockInfo, ExtractedField } from './types';
import { extractFieldsFromText } from './field-extractor';

// =============================================================================
// CONFIG
// =============================================================================

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID!;
const GCP_LOCATION = process.env.GCP_LOCATION || 'us';
const DEFAULT_PROCESSOR_ID = process.env.DOCAI_PROCESSOR_ID || '';
const PROCESSOR_MAP = parseProcessorMap(process.env.DOCAI_PROCESSOR_MAP);

// Client uses Application Default Credentials (ADC) automatically in Cloud Run
const client = new DocumentProcessorServiceClient();

// =============================================================================
// MAIN PROCESSING FUNCTION
// =============================================================================

export async function processDocument(
    fileBytes: Buffer,
    mimeType: string,
    profileKey: string
): Promise<ExtractionResult> {
    console.log(`Processing document with profile: ${profileKey}, mime: ${mimeType}`);

    const processorName = resolveProcessorName(profileKey);

    // Build request with optimized OCR config for English documents
    const request = {
        name: processorName,
        rawDocument: {
            content: fileBytes.toString('base64'),
            mimeType,
        },
        processOptions: {
            ocrConfig: {
                // Enable native PDF text extraction (more accurate for PDFs with embedded text)
                enableNativePdfParsing: true,
                // Language hints for better accuracy
                hints: {
                    languageHints: ['en'],
                },
                // Enable quality scores for diagnostics
                enableImageQualityScores: true,
                // Advanced OCR features
                advancedOcrOptions: ['DOCUMENT_EXTRACTION'],
            },
        },
    };

    // Call Document AI
    const [response] = await client.processDocument(request);
    const document = response.document;

    if (!document) {
        throw new Error('No document in response');
    }

    // Extract text content
    const textContent = document.text || '';

    // Build pages info with anchors/bboxes
    const pagesJson = buildPagesInfo(document);

    // Extract fields based on profile
    const extractedFields = extractFieldsFromText(textContent, profileKey, pagesJson);

    return {
        rawResponse: serializeResponse(response),
        textContent,
        pagesJson,
        extractedFields,
    };
}

// =============================================================================
// PROCESSOR RESOLUTION
// =============================================================================

function resolveProcessorName(profileKey: string): string {
    const processorId = PROCESSOR_MAP[profileKey] || DEFAULT_PROCESSOR_ID;
    if (!processorId) {
        throw new Error(`Missing Document AI processor ID for profile: ${profileKey}`);
    }
    return `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}/processors/${processorId}`;
}

function parseProcessorMap(raw?: string): Record<string, string> {
    if (!raw) return {};

    try {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch {
        // fall through to key=value parsing
    }

    return raw
        .split(',')
        .map((pair) => pair.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, pair) => {
            const [key, value] = pair.split('=').map((part) => part.trim());
            if (key && value) {
                acc[key] = value;
            }
            return acc;
        }, {});
}

function serializeResponse(response: unknown): unknown {
    try {
        return JSON.parse(JSON.stringify(response));
    } catch (error) {
        console.warn('[DocAI] Failed to serialize response:', error);
        return null;
    }
}

// =============================================================================
// PAGE/BLOCK INFO BUILDER
// =============================================================================

function buildPagesInfo(document: any): PageInfo[] {
    const pages: PageInfo[] = [];

    if (!document.pages) {
        return pages;
    }

    for (let i = 0; i < document.pages.length; i++) {
        const page = document.pages[i];
        const blocks: BlockInfo[] = [];

        // Extract text blocks with bounding boxes
        for (const block of page.blocks || []) {
            const blockText = extractTextFromLayout(document.text, block.layout);
            const bbox = normalizeBoundingPoly(block.layout?.boundingPoly);

            blocks.push({
                text: blockText,
                confidence: block.layout?.confidence || 0,
                bbox,
            });
        }

        pages.push({
            pageIndex: i,
            width: page.dimension?.width || 0,
            height: page.dimension?.height || 0,
            blocks,
        });
    }

    return pages;
}

// =============================================================================
// TEXT EXTRACTION HELPERS
// =============================================================================

function extractTextFromLayout(fullText: string, layout: any): string {
    if (!layout?.textAnchor?.textSegments) {
        return '';
    }

    let text = '';
    for (const segment of layout.textAnchor.textSegments) {
        const start = parseInt(segment.startIndex || '0');
        const end = parseInt(segment.endIndex || '0');
        text += fullText.substring(start, end);
    }
    return text.trim();
}

function normalizeBoundingPoly(boundingPoly: any): { x0: number; y0: number; x1: number; y1: number } {
    if (!boundingPoly?.normalizedVertices || boundingPoly.normalizedVertices.length < 4) {
        return { x0: 0, y0: 0, x1: 0, y1: 0 };
    }

    const vertices = boundingPoly.normalizedVertices;

    // Normalized vertices are 0-1, representing percentage of page dimensions
    return {
        x0: vertices[0]?.x || 0,
        y0: vertices[0]?.y || 0,
        x1: vertices[2]?.x || 0,
        y1: vertices[2]?.y || 0,
    };
}
