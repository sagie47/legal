/**
 * OCR Extraction Worker
 * 
 * Cloud Run worker that polls document_extractions queue
 * and processes documents via Google Document AI.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { processDocument } from './docai';
import { generateProposals } from './proposal-generator';
import { ExtractionJob, ExtractionResult } from './types';

// =============================================================================
// CONFIG
// =============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000');
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
const RETRY_DELAY_MS = parseInt(process.env.RETRY_DELAY_MS || '30000');
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

let activeJobs = 0;
let isShuttingDown = false;

// =============================================================================
// POLLING LOOP
// =============================================================================

async function pollForJobs(): Promise<void> {
    if (isShuttingDown) return;

    const availableSlots = MAX_CONCURRENT_JOBS - activeJobs;
    if (availableSlots <= 0) {
        console.log('All job slots full, waiting...');
        return;
    }

    // Fetch queued jobs that are ready to run
    const { data: jobs, error } = await supabase
        .from('document_extractions')
        .select('*')
        .eq('status', 'queued')
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${new Date().toISOString()}`)
        .order('created_at', { ascending: true })
        .limit(availableSlots);

    if (error) {
        console.error('Failed to fetch jobs:', error);
        return;
    }

    if (!jobs || jobs.length === 0) {
        return;
    }

    console.log(`Found ${jobs.length} queued job(s)`);

    // Process jobs concurrently
    for (const job of jobs) {
        processJob(job as ExtractionJob);
    }
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(job: ExtractionJob): Promise<void> {
    activeJobs++;
    console.log(`[${job.id}] Starting extraction (attempt ${job.attempt_count + 1})`);

    try {
        const claimed = await claimJob(job);
        if (!claimed) {
            console.log(`[${job.id}] Job already claimed by another worker, skipping`);
            return;
        }

        // Emit OCR_STARTED event
        await emitEvent(job, 'OCR_STARTED', {
            extractionId: job.id,
            attempt: job.attempt_count + 1,
        });

        // Fetch file bytes from Supabase Storage
        const fileBytes = await fetchFileBytes(job.document_file_id);
        if (!fileBytes) {
            throw new Error('Failed to fetch file bytes');
        }

        // Get file metadata for mime type
        const { data: fileData } = await supabase
            .from('document_files')
            .select('mime_type, file_name')
            .eq('id', job.document_file_id)
            .single();

        const mimeType = fileData?.mime_type || 'application/pdf';

        // Call Document AI
        const result = await processDocument(fileBytes, mimeType, job.profile_key);

        // Store results
        await supabase
            .from('document_extractions')
            .update({
                status: 'succeeded',
                finished_at: new Date().toISOString(),
                raw_json: result.rawResponse,
                text_content: result.textContent,
                pages_json: result.pagesJson,
                extracted_fields_json: result.extractedFields,
                error_code: null,
                error_message: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        // Generate fact proposals
        await generateProposals(supabase, job, result);

        // Emit OCR_COMPLETED event
        await emitEvent(job, 'OCR_COMPLETED', {
            extractionId: job.id,
            fieldsExtracted: Object.keys(result.extractedFields || {}).length,
        });

        console.log(`[${job.id}] Extraction completed successfully`);

    } catch (error) {
        console.error(`[${job.id}] Extraction failed:`, error);
        await handleJobFailure(job, error);
    } finally {
        activeJobs--;
    }
}

async function claimJob(job: ExtractionJob): Promise<boolean> {
    const { data, error } = await supabase
        .from('document_extractions')
        .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            attempt_count: job.attempt_count + 1,
            updated_at: new Date().toISOString(),
        })
        .eq('id', job.id)
        .eq('status', 'queued')
        .select('id')
        .maybeSingle();

    if (error) {
        console.error(`[${job.id}] Failed to claim job:`, error);
        return false;
    }

    return !!data;
}

// =============================================================================
// FILE FETCHING
// =============================================================================

async function fetchFileBytes(documentFileId: string): Promise<Buffer | null> {
    // Get storage path from document_files
    const { data: fileData, error: fileError } = await supabase
        .from('document_files')
        .select('storage_path')
        .eq('id', documentFileId)
        .single();

    if (fileError || !fileData) {
        console.error('Failed to get file path:', fileError);
        return null;
    }

    // Download from Supabase Storage
    const { data: blob, error: downloadError } = await supabase.storage
        .from('documents')
        .download(fileData.storage_path);

    if (downloadError || !blob) {
        console.error('Failed to download file:', downloadError);
        return null;
    }

    // Convert to Buffer
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

async function handleJobFailure(job: ExtractionJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRetryable = isTransientError(error);
    const shouldRetry = isRetryable && job.attempt_count < MAX_RETRIES;

    if (shouldRetry) {
        // Schedule retry
        const nextAttempt = new Date(Date.now() + RETRY_DELAY_MS * Math.pow(2, job.attempt_count));

        await supabase
            .from('document_extractions')
            .update({
                status: 'queued',
                next_attempt_at: nextAttempt.toISOString(),
                error_code: 'TRANSIENT',
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        console.log(`[${job.id}] Scheduled retry at ${nextAttempt.toISOString()}`);
    } else {
        // Mark as failed permanently
        await supabase
            .from('document_extractions')
            .update({
                status: 'failed',
                finished_at: new Date().toISOString(),
                error_code: 'PERMANENT',
                error_message: errorMessage,
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        // Emit OCR_FAILED event
        await emitEvent(job, 'OCR_FAILED', {
            extractionId: job.id,
            errorMessage,
        });
    }
}

function isTransientError(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        return (
            msg.includes('timeout') ||
            msg.includes('network') ||
            msg.includes('rate limit') ||
            msg.includes('503') ||
            msg.includes('429')
        );
    }
    return false;
}

// =============================================================================
// EVENT EMISSION
// =============================================================================

async function emitEvent(
    job: ExtractionJob,
    eventType: string,
    payload: Record<string, unknown>
): Promise<void> {
    await supabase.from('case_events').insert({
        org_id: job.org_id,
        application_id: job.application_id,
        event_type: eventType,
        occurred_at: new Date().toISOString(),
        actor_user_id: null, // System event
        payload,
    });
}

// =============================================================================
// GRACEFUL SHUTDOWN
// =============================================================================

function setupGracefulShutdown(): void {
    const shutdown = async () => {
        console.log('Received shutdown signal, finishing active jobs...');
        isShuttingDown = true;

        // Wait for active jobs to complete (max 30 seconds)
        const maxWait = 30000;
        const start = Date.now();
        while (activeJobs > 0 && Date.now() - start < maxWait) {
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('Shutdown complete');
        process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log('OCR Extraction Worker starting...');
    console.log(`Poll interval: ${POLL_INTERVAL_MS}ms, Max concurrent: ${MAX_CONCURRENT_JOBS}`);

    setupGracefulShutdown();

    // Start polling loop
    while (!isShuttingDown) {
        try {
            await pollForJobs();
        } catch (error) {
            console.error('Poll error:', error);
        }
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
}

main().catch(console.error);
