import React from 'react';
import {
    AlertTriangle,
    AlertCircle,
    Clock,
    CheckCircle2,
    Shield,
    Calendar,
    RefreshCw
} from 'lucide-react';
import { useEvaluation, type Deadline, type Blocker, type Warning } from '../../context/EvaluationContext';

// ============================================================================
// STATUS BAR COMPONENT
// ============================================================================

export const EvaluationStatusBar: React.FC = () => {
    const {
        evaluation,
        isLoading,
        hasBlockers,
        hasCriticalDeadlines,
        isMaintainedStatusEligible,
        statusExpiryAt,
        refresh
    } = useEvaluation();

    if (isLoading) {
        return (
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <RefreshCw size={14} className="animate-spin" />
                    Evaluating application...
                </div>
            </div>
        );
    }

    if (!evaluation) return null;

    // Determine overall status color
    const getStatusColor = () => {
        if (hasBlockers) return 'bg-red-50 border-red-200';
        if (hasCriticalDeadlines) return 'bg-orange-50 border-orange-200';
        if (evaluation.warnings.length > 0) return 'bg-yellow-50 border-yellow-200';
        return 'bg-green-50 border-green-200';
    };

    return (
        <div className={`border-b px-6 py-3 ${getStatusColor()}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                    {/* Maintained Status Badge */}
                    {statusExpiryAt && (
                        <div className="flex items-center gap-2">
                            <Shield size={16} className={isMaintainedStatusEligible ? 'text-green-600' : 'text-gray-400'} />
                            <span className="text-sm">
                                {isMaintainedStatusEligible ? (
                                    <span className="text-green-700 font-medium">Maintained Status ✓</span>
                                ) : (
                                    <span className="text-gray-600">Pending Submission</span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* Status Expiry */}
                    {statusExpiryAt && (
                        <div className="flex items-center gap-2 text-sm">
                            <Calendar size={14} className="text-gray-500" />
                            <span className="text-gray-600">
                                Expires: <span className="font-medium">{new Date(statusExpiryAt).toLocaleDateString()}</span>
                            </span>
                        </div>
                    )}

                    {/* Blockers Count */}
                    {hasBlockers && (
                        <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle size={14} />
                            <span className="text-sm font-medium">{evaluation.blockers.length} blocker(s)</span>
                        </div>
                    )}

                    {/* Warnings Count */}
                    {evaluation.warnings.length > 0 && (
                        <div className="flex items-center gap-2 text-yellow-700">
                            <AlertTriangle size={14} />
                            <span className="text-sm font-medium">{evaluation.warnings.length} warning(s)</span>
                        </div>
                    )}

                    {/* All Clear */}
                    {!hasBlockers && evaluation.warnings.length === 0 && (
                        <div className="flex items-center gap-2 text-green-700">
                            <CheckCircle2 size={14} />
                            <span className="text-sm font-medium">Ready for submission</span>
                        </div>
                    )}
                </div>

                <button
                    onClick={() => refresh()}
                    className="p-1.5 hover:bg-white/50 rounded text-gray-500 transition-colors"
                    title="Re-evaluate"
                >
                    <RefreshCw size={14} />
                </button>
            </div>
        </div>
    );
};

// ============================================================================
// DEADLINES LIST
// ============================================================================

export const DeadlinesList: React.FC<{ deadlines: Deadline[] }> = ({ deadlines }) => {
    if (deadlines.length === 0) return null;

    const getSeverityStyles = (severity: string) => {
        switch (severity) {
            case 'critical': return 'bg-red-50 border-red-200 text-red-800';
            case 'warning': return 'bg-orange-50 border-orange-200 text-orange-800';
            default: return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    return (
        <div className="space-y-2">
            {deadlines.map((deadline, idx) => (
                <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${getSeverityStyles(deadline.severity)}`}
                >
                    <Clock size={16} />
                    <div className="flex-1">
                        <p className="text-sm font-medium">{deadline.message}</p>
                        <p className="text-xs opacity-75">Due: {new Date(deadline.dueAt).toLocaleDateString()}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// BLOCKERS LIST
// ============================================================================

export const BlockersList: React.FC<{ blockers: Blocker[]; onNavigate?: (slotId: string) => void }> = ({
    blockers,
    onNavigate
}) => {
    if (blockers.length === 0) return null;

    return (
        <div className="space-y-2">
            {blockers.map((blocker, idx) => (
                <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-red-50 border-red-200 text-red-800 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => blocker.slotDefinitionId && onNavigate?.(blocker.slotDefinitionId)}
                >
                    <AlertCircle size={16} />
                    <div className="flex-1">
                        <p className="text-sm font-medium">{blocker.message}</p>
                        {blocker.slotDefinitionId && (
                            <p className="text-xs opacity-75">Slot: {blocker.slotDefinitionId}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// WARNINGS LIST
// ============================================================================

export const WarningsList: React.FC<{ warnings: Warning[] }> = ({ warnings }) => {
    if (warnings.length === 0) return null;

    return (
        <div className="space-y-2">
            {warnings.map((warning, idx) => (
                <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800"
                >
                    <AlertTriangle size={16} />
                    <p className="text-sm">{warning.message}</p>
                </div>
            ))}
        </div>
    );
};

// ============================================================================
// COMBINED EVALUATION PANEL
// ============================================================================

export const EvaluationPanel: React.FC<{ onNavigateToDocuments?: () => void }> = ({
    onNavigateToDocuments
}) => {
    const { evaluation, isLoading } = useEvaluation();

    if (isLoading) {
        return (
            <div className="p-6 text-center text-gray-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                <p className="text-sm">Evaluating...</p>
            </div>
        );
    }

    if (!evaluation) {
        return (
            <div className="p-6 text-center text-gray-400">
                <p className="text-sm">No evaluation available</p>
            </div>
        );
    }

    const { deadlines, blockers, warnings } = evaluation;
    const hasIssues = blockers.length > 0 || warnings.length > 0 || deadlines.length > 0;

    if (!hasIssues) {
        return (
            <div className="p-6 text-center">
                <CheckCircle2 size={40} className="mx-auto mb-3 text-green-500" />
                <p className="font-medium text-green-700">All checks passed!</p>
                <p className="text-sm text-gray-500 mt-1">Application is ready for submission.</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            {deadlines.length > 0 && (
                <div>
                    <h4 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2">
                        <Clock size={14} /> Deadlines
                    </h4>
                    <DeadlinesList deadlines={deadlines} />
                </div>
            )}

            {blockers.length > 0 && (
                <div>
                    <h4 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2">
                        <AlertCircle size={14} /> Blockers
                    </h4>
                    <BlockersList
                        blockers={blockers}
                        onNavigate={() => onNavigateToDocuments?.()}
                    />
                </div>
            )}

            {warnings.length > 0 && (
                <div>
                    <h4 className="font-bold text-sm text-gray-700 mb-2 flex items-center gap-2">
                        <AlertTriangle size={14} /> Warnings
                    </h4>
                    <WarningsList warnings={warnings} />
                </div>
            )}
        </div>
    );
};
