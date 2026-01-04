import { supabase } from '../lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export type EventType =
    | 'APPLICATION_CREATED'
    | 'APPLICATION_SUBMITTED'
    | 'STATUS_EXPIRY_SET'
    | 'SLOT_UPLOADED'
    | 'SLOT_VERIFIED'
    | 'SLOT_REJECTED'
    | 'DOCUMENT_ATTACHED'
    | 'DOCUMENT_REMOVED'
    | 'EVALUATION_RAN'
    | 'MAINTAINED_STATUS_ELIGIBLE'
    | 'RESTORATION_REQUIRED'
    | 'DECISION_APPROVED'
    | 'DECISION_REFUSED';

export interface CaseEvent {
    id: string;
    orgId: string;
    applicationId: string | null;
    personId: string | null;
    eventType: EventType;
    occurredAt: string;
    actorUserId: string | null;
    payload: Record<string, unknown> | null;
    createdAt: string;
}

// ============================================================================
// EVENT LOGGING
// ============================================================================

/**
 * Logs an event to the case_events table.
 * Events are append-only and should never be updated or deleted.
 */
export async function logEvent(
    orgId: string,
    eventType: EventType,
    options?: {
        applicationId?: string;
        personId?: string;
        actorUserId?: string;
        payload?: Record<string, unknown>;
        occurredAt?: Date;
    }
): Promise<CaseEvent> {
    const { data, error } = await supabase
        .from('case_events')
        .insert({
            org_id: orgId,
            application_id: options?.applicationId || null,
            person_id: options?.personId || null,
            event_type: eventType,
            occurred_at: options?.occurredAt?.toISOString() || new Date().toISOString(),
            actor_user_id: options?.actorUserId || null,
            payload: options?.payload || null,
        })
        .select()
        .single();

    if (error) throw error;
    return transformEvent(data);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function logApplicationCreated(
    orgId: string,
    applicationId: string,
    actorUserId?: string,
    payload?: Record<string, unknown>
): Promise<CaseEvent> {
    return logEvent(orgId, 'APPLICATION_CREATED', {
        applicationId,
        actorUserId,
        payload,
    });
}

export async function logApplicationSubmitted(
    orgId: string,
    applicationId: string,
    actorUserId?: string
): Promise<CaseEvent> {
    return logEvent(orgId, 'APPLICATION_SUBMITTED', {
        applicationId,
        actorUserId,
        payload: { submittedAt: new Date().toISOString() },
    });
}

export async function logSlotVerified(
    orgId: string,
    applicationId: string,
    slotDefinitionId: string,
    actorUserId?: string
): Promise<CaseEvent> {
    return logEvent(orgId, 'SLOT_VERIFIED', {
        applicationId,
        actorUserId,
        payload: { slotDefinitionId },
    });
}

export async function logSlotRejected(
    orgId: string,
    applicationId: string,
    slotDefinitionId: string,
    rejectionReason: string,
    actorUserId?: string
): Promise<CaseEvent> {
    return logEvent(orgId, 'SLOT_REJECTED', {
        applicationId,
        actorUserId,
        payload: { slotDefinitionId, rejectionReason },
    });
}

export async function logSlotUploaded(
    orgId: string,
    applicationId: string,
    slotId: string,
    actorUserId?: string,
    fileName?: string
): Promise<CaseEvent> {
    return logEvent(orgId, 'SLOT_UPLOADED', {
        applicationId,
        actorUserId,
        payload: { slotId, fileName },
    });
}

export async function logDocumentRemoved(
    orgId: string,
    applicationId: string,
    slotId: string,
    actorUserId?: string
): Promise<CaseEvent> {
    return logEvent(orgId, 'DOCUMENT_REMOVED', {
        applicationId,
        actorUserId,
        payload: { slotId, removedAt: new Date().toISOString() },
    });
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Gets all events for an application, ordered by occurrence time.
 */
export async function getApplicationEvents(
    applicationId: string,
    options?: { limit?: number }
): Promise<CaseEvent[]> {
    let query = supabase
        .from('case_events')
        .select('*')
        .eq('application_id', applicationId)
        .order('occurred_at', { ascending: false });

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(transformEvent);
}

/**
 * Gets all events for a person, ordered by occurrence time.
 */
export async function getPersonEvents(
    personId: string,
    options?: { limit?: number }
): Promise<CaseEvent[]> {
    let query = supabase
        .from('case_events')
        .select('*')
        .eq('person_id', personId)
        .order('occurred_at', { ascending: false });

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(transformEvent);
}

/**
 * Gets the most recent event of a specific type for an application.
 */
export async function getLastEventOfType(
    applicationId: string,
    eventType: EventType
): Promise<CaseEvent | null> {
    const { data, error } = await supabase
        .from('case_events')
        .select('*')
        .eq('application_id', applicationId)
        .eq('event_type', eventType)
        .order('occurred_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return null;
    return transformEvent(data);
}

/**
 * Checks if an event of a specific type exists for an application.
 */
export async function hasEventOfType(
    applicationId: string,
    eventType: EventType
): Promise<boolean> {
    const event = await getLastEventOfType(applicationId, eventType);
    return event !== null;
}

// ============================================================================
// TRANSFORM HELPER
// ============================================================================

function transformEvent(data: Record<string, unknown>): CaseEvent {
    return {
        id: data.id as string,
        orgId: data.org_id as string,
        applicationId: data.application_id as string | null,
        personId: data.person_id as string | null,
        eventType: data.event_type as EventType,
        occurredAt: data.occurred_at as string,
        actorUserId: data.actor_user_id as string | null,
        payload: data.payload as Record<string, unknown> | null,
        createdAt: data.created_at as string,
    };
}
