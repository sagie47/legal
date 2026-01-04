import React from 'react';
import {
    Clock,
    FileCheck,
    FileX,
    Upload,
    Send,
    PlusCircle,
    AlertCircle,
    CheckCircle2,
    Shield
} from 'lucide-react';
import { useEvaluation, type CaseEvent } from '../../context/EvaluationContext';

// ============================================================================
// EVENT ICON MAPPING
// ============================================================================

const getEventIcon = (eventType: string) => {
    switch (eventType) {
        case 'APPLICATION_CREATED':
            return <PlusCircle size={16} className="text-blue-500" />;
        case 'APPLICATION_SUBMITTED':
            return <Send size={16} className="text-green-500" />;
        case 'SLOT_UPLOADED':
        case 'DOCUMENT_ATTACHED':
            return <Upload size={16} className="text-purple-500" />;
        case 'SLOT_VERIFIED':
            return <FileCheck size={16} className="text-green-500" />;
        case 'SLOT_REJECTED':
            return <FileX size={16} className="text-red-500" />;
        case 'MAINTAINED_STATUS_ELIGIBLE':
            return <Shield size={16} className="text-green-500" />;
        case 'RESTORATION_REQUIRED':
            return <AlertCircle size={16} className="text-orange-500" />;
        case 'DECISION_APPROVED':
            return <CheckCircle2 size={16} className="text-green-500" />;
        case 'DECISION_REFUSED':
            return <FileX size={16} className="text-red-500" />;
        default:
            return <Clock size={16} className="text-gray-400" />;
    }
};

const formatEventType = (eventType: string): string => {
    return eventType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
};

const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

// ============================================================================
// ACTIVITY LOG COMPONENT
// ============================================================================

export const ActivityLog: React.FC = () => {
    const { events, isLoading } = useEvaluation();

    if (isLoading) {
        return (
            <div className="p-8 text-center text-gray-500">
                <Clock size={24} className="animate-pulse mx-auto mb-2" />
                <p className="text-sm">Loading activity...</p>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="p-8 text-center text-gray-400">
                <Clock size={40} className="mx-auto mb-3 opacity-50" />
                <p className="font-medium">No activity yet</p>
                <p className="text-sm mt-1">Events will appear here as you work on the application.</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <h3 className="font-bold text-gray-900 mb-6">Activity Log</h3>

            <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

                <div className="space-y-4">
                    {events.map((event, idx) => (
                        <div key={event.id} className="relative flex gap-4">
                            {/* Icon */}
                            <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10">
                                {getEventIcon(event.eventType)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-gray-900">
                                        {formatEventType(event.eventType)}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {formatTimestamp(event.occurredAt)}
                                    </span>
                                </div>

                                {/* Payload details */}
                                {event.payload && Object.keys(event.payload).length > 0 && (
                                    <div className="mt-2 text-sm text-gray-600">
                                        {event.payload.slotDefinitionId && (
                                            <span className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                {event.payload.slotDefinitionId as string}
                                            </span>
                                        )}
                                        {event.payload.rejectionReason && (
                                            <p className="mt-1 text-red-600">
                                                Reason: {event.payload.rejectionReason as string}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// COMPACT ACTIVITY LIST (for sidebar/overview)
// ============================================================================

export const ActivityListCompact: React.FC<{ limit?: number }> = ({ limit = 5 }) => {
    const { events } = useEvaluation();
    const displayEvents = events.slice(0, limit);

    if (displayEvents.length === 0) {
        return (
            <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
        );
    }

    return (
        <div className="space-y-2">
            {displayEvents.map(event => (
                <div key={event.id} className="flex items-center gap-3 text-sm">
                    {getEventIcon(event.eventType)}
                    <span className="flex-1 text-gray-600 truncate">
                        {formatEventType(event.eventType)}
                    </span>
                    <span className="text-xs text-gray-400">
                        {formatTimestamp(event.occurredAt)}
                    </span>
                </div>
            ))}
        </div>
    );
};
