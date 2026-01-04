/**
 * Study Permit Page
 *
 * Pure renderer for Study Permit flows.
 * ALL data comes from spBootstrap Edge Function.
 * ALL mutations go through spUpdate/attach-file/spSubmit Edge Functions.
 * NO direct Supabase calls in this file.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    FileText,
    Loader2,
    RefreshCw,
    Send,
    Upload,
    Eye,
    X
} from 'lucide-react';
import { Button, Panel, PanelContent } from '../../components/ui';
import {
    spBootstrap,
    spUpdate,
    spSubmit,
    uploadAndAttach,
    groupSlotsByGroup,
    formatDate,
    daysUntil,
    type StudyPermitBootstrapResponse,
    type StudyPermitAttributes,
    type SlotWithDocument,
    type ActionIntent,
    type SlotState,
    type Evaluation
} from '../../services/spClient';
import { useEvaluationOptional } from '../../context/EvaluationContext';

// =============================================================================
// TYPES
// =============================================================================

interface StudyPermitPageProps {
    applicationId: string;
    orgId: string;
    onBack?: () => void;
}

interface StudyPermitFormState {
    actionIntent: ActionIntent;
    program: {
        dliNumber: string;
        institutionName: string;
        campusCity: string;
        credentialLevel: string;
        programName: string;
        startDate: string;
        endDate: string;
        tuitionFirstYear: string;
        deliveryMode: string;
    };
    outsideCanadaContext: {
        countryOfResidence: string;
        countryOfCitizenship: string;
    };
    insideCanadaContext: {
        currentStatusType: 'STUDY_PERMIT' | 'VISITOR' | 'WORK_PERMIT';
        currentStatusExpiresAt: string;
        lastEntryDate: string;
    };
    familyContext: {
        hasAccompanyingSpouse: boolean;
        hasAccompanyingDependents: boolean;
    };
    palTal: {
        required: boolean;
        provinceOrTerritory: string;
        documentProvided: boolean;
    };
}

// =============================================================================
// STATUS PILL
// =============================================================================

const StatusPill = ({ status }: { status: SlotState }) => {
    const config: Record<SlotState, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
        missing: { bg: 'bg-white border-red-600', text: 'text-red-600', icon: <AlertCircle size={12} />, label: 'MISSING' },
        uploaded: { bg: 'bg-white border-blue-600', text: 'text-blue-600', icon: <Upload size={12} />, label: 'UPLOADED' },
        in_review: { bg: 'bg-white border-orange-500', text: 'text-orange-600', icon: <Clock size={12} />, label: 'IN REVIEW' },
        verified: { bg: 'bg-white border-green-600', text: 'text-green-600', icon: <CheckCircle2 size={12} />, label: 'VERIFIED' },
        rejected: { bg: 'bg-black border-red-600', text: 'text-red-500', icon: <X size={12} />, label: 'REJECTED' },
        expired: { bg: 'bg-gray-100 border-gray-400', text: 'text-gray-600', icon: <Clock size={12} />, label: 'EXPIRED' },
    };
    const c = config[status] || config.missing;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider border ${c.bg} ${c.text}`}>
            {c.icon} {c.label}
        </span>
    );
};

// =============================================================================
// STATUS BAR
// =============================================================================

interface StudyStatusBarProps {
    processingContext: string | null;
    actionIntent: ActionIntent | null;
    evaluation: Evaluation;
    program: StudyPermitAttributes['program'] | null;
    statusExpiryAt: string | null;
    submittedAt: string | null;
}

const StudyStatusBar: React.FC<StudyStatusBarProps> = ({
    processingContext,
    actionIntent,
    evaluation,
    program,
    statusExpiryAt,
    submittedAt
}) => {
    const isInside = processingContext === 'INSIDE_CANADA';
    const effectiveAction = actionIntent || (processingContext === 'OUTSIDE_CANADA' ? 'APPLY' : 'EXTEND');
    const contextLabel = processingContext === 'OUTSIDE_CANADA'
        ? 'Outside Apply'
        : effectiveAction === 'RESTORE'
            ? 'Restore'
            : 'Inside Extend';

    const programStart = program?.startDate?.trim() ? formatDate(program.startDate) : null;
    const programEnd = program?.endDate?.trim() ? formatDate(program.endDate) : null;
    const programLabel = programStart || programEnd
        ? `${programStart || 'Start not set'} – ${programEnd || 'End not set'}`
        : 'Program dates not set';

    const blockersCount = evaluation.blockers.length;
    const warningsCount = evaluation.warnings.length;

    const daysLeft = daysUntil(statusExpiryAt);
    const expiryTone = (() => {
        if (daysLeft === null) return 'bg-gray-100 text-gray-600';
        if (daysLeft <= 0) return 'bg-red-100 text-red-700';
        if (daysLeft <= 7) return 'bg-red-100 text-red-700';
        if (daysLeft <= 14) return 'bg-amber-100 text-amber-700';
        if (daysLeft <= 30) return 'bg-yellow-100 text-yellow-700';
        return 'bg-green-100 text-green-700';
    })();
    const expiryLabel = statusExpiryAt
        ? `${formatDate(statusExpiryAt)}${daysLeft !== null ? ` (${daysLeft} days)` : ''}`
        : 'Not set';

    const statusFlagLabel = evaluation.derived.isMaintainedStatusEligible
        ? 'Maintained status eligible'
        : evaluation.derived.restorationRequired
            ? 'Restoration required'
            : submittedAt
                ? 'Submitted'
                : 'Maintained status pending';

    const statusFlagTone = evaluation.derived.isMaintainedStatusEligible
        ? 'bg-green-100 text-green-700'
        : evaluation.derived.restorationRequired
            ? 'bg-red-100 text-red-700'
            : 'bg-gray-100 text-gray-600';

    return (
        <Panel className="rounded-sm shadow-sm">
            <PanelContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Context</p>
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wide">
                            {contextLabel}
                        </span>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Program Dates</p>
                        <div className="text-sm font-medium text-gray-900">{programLabel}</div>
                    </div>
                    {isInside && (
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status Expiry</p>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm ${expiryTone}`}>
                                <Clock size={16} />
                                <span className="font-medium">{expiryLabel}</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
                    {isInside && (
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm ${statusFlagTone}`}>
                            {evaluation.derived.isMaintainedStatusEligible ? (
                                <CheckCircle2 size={16} />
                            ) : evaluation.derived.restorationRequired ? (
                                <AlertCircle size={16} />
                            ) : (
                                <Clock size={16} />
                            )}
                            <span className="font-medium">{statusFlagLabel}</span>
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Readiness</p>
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm ${evaluation.isReadyToSubmit ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {evaluation.isReadyToSubmit ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                <span className="font-medium">
                                    {evaluation.isReadyToSubmit ? 'Ready to submit' : `${blockersCount} blocker(s)`}
                                </span>
                            </span>
                            {warningsCount > 0 && (
                                <span className="text-xs text-amber-700">{warningsCount} warning(s)</span>
                            )}
                        </div>
                    </div>
                </div>
            </PanelContent>
        </Panel>
    );
};

// =============================================================================
// ALERTS PANEL
// =============================================================================

interface AlertsPanelProps {
    blockers: Evaluation['blockers'];
    warnings: Evaluation['warnings'];
    deadlines: Evaluation['deadlines'];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({ blockers, warnings, deadlines }) => {
    if (blockers.length === 0 && warnings.length === 0 && deadlines.length === 0) {
        return null;
    }

    const criticalDeadlines = deadlines.filter(deadline => deadline.severity === 'critical');
    const warningDeadlines = deadlines.filter(deadline => deadline.severity === 'warning');

    return (
        <Panel>
            <PanelContent className="space-y-3">
                {criticalDeadlines.map(deadline => (
                    <div key={deadline.key} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-red-600 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <AlertCircle className="text-red-600 shrink-0" size={20} />
                        <span className="text-gray-900 font-medium">{deadline.message}</span>
                    </div>
                ))}

                {blockers.map((blocker, idx) => (
                    <div key={`${blocker.code}-${idx}`} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-red-600 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <AlertCircle className="text-red-600 shrink-0" size={20} />
                        <span className="text-gray-900 font-medium">{blocker.message}</span>
                    </div>
                ))}

                {warningDeadlines.map(deadline => (
                    <div key={deadline.key} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-orange-500 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <Clock className="text-orange-500 shrink-0" size={20} />
                        <span className="text-gray-900">{deadline.message}</span>
                    </div>
                ))}

                {warnings.map((warning, idx) => (
                    <div key={`${warning.code}-${idx}`} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-orange-500 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <Clock className="text-orange-500 shrink-0" size={20} />
                        <span className="text-gray-900">{warning.message}</span>
                    </div>
                ))}
            </PanelContent>
        </Panel>
    );
};

// =============================================================================
// SLOT ROW
// =============================================================================

interface SlotRowProps {
    slot: SlotWithDocument;
    onUpload: (slotId: string, file: File) => Promise<void>;
    isUploading?: boolean;
}

const SlotRow: React.FC<SlotRowProps> = ({ slot, onUpload, isUploading }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUploadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(slot.id, file);
        }
    };

    return (
        <div className="flex items-center justify-between p-3 rounded-sm border-b border-gray-100 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <FileText size={16} className="text-gray-400 mt-0.5" />
                <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{slot.label}</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase tracking-wider font-bold rounded-sm ${slot.required
                            ? 'text-red-600 border border-red-600 bg-red-50'
                            : 'text-gray-500 border border-gray-200 bg-gray-50'
                            }`}>
                            {slot.required ? 'REQUIRED' : 'OPTIONAL'}
                        </span>
                        <span className="text-[10px] font-mono uppercase text-gray-400">
                            {slot.scope}
                        </span>
                    </div>
                    {slot.document?.fileName && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                            {slot.document.fileName}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {slot.document?.previewUrl && (
                    <a
                        href={slot.document.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-sm hover:bg-gray-100 text-gray-500"
                        title="Preview"
                    >
                        <Eye size={14} />
                    </a>
                )}
                <StatusPill status={slot.state} />
                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.jpg,.jpeg,.png"
                />
                <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="p-1.5 rounded-sm hover:bg-gray-100 text-gray-500 disabled:opacity-50"
                >
                    {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                </button>
            </div>
        </div>
    );
};

// =============================================================================
// SUGGESTIONS PANEL (OCR Fact Proposals)
// =============================================================================

interface PendingProposal {
    id: string;
    fieldKey: string;
    targetEntityType: string;
    proposedValue: unknown;
    currentValue: unknown | null;
    confidence: number;
    severity: string;
    sourceAnchor: { pageIndex: number; bbox: object; snippet: string } | null;
    sourceSlotId: string | null;
}

interface SuggestionsPanelProps {
    proposals: PendingProposal[];
    onAccept: (proposalId: string) => Promise<void>;
    onReject: (proposalId: string, reason: string) => Promise<void>;
    isResolving: string | null;
}

const SuggestionsPanel: React.FC<SuggestionsPanelProps> = ({
    proposals,
    onAccept,
    onReject,
    isResolving
}) => {
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');

    if (proposals.length === 0) return null;

    const grouped = proposals.reduce((acc, p) => {
        const key = p.targetEntityType;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {} as Record<string, PendingProposal[]>);

    const getFieldLabel = (fieldKey: string) => {
        return fieldKey
            .split('.')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' / ');
    };

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.9) return 'text-green-600';
        if (confidence >= 0.8) return 'text-amber-600';
        return 'text-red-600';
    };

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'high': return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">High</span>;
            case 'medium': return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">Medium</span>;
            default: return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Low</span>;
        }
    };

    const formatValue = (val: unknown): string => {
        if (val === null || val === undefined) return '-';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const handleRejectConfirm = async (proposalId: string, severity: string) => {
        if (severity === 'high' && !rejectReason.trim()) {
            return;
        }
        await onReject(proposalId, rejectReason);
        setRejectingId(null);
        setRejectReason('');
    };

    const safeProposals = proposals.filter(p => p.confidence >= 0.9 && p.severity !== 'high');
    const canBulkAccept = safeProposals.length > 0;

    const handleBulkAccept = async () => {
        for (const p of safeProposals) {
            await onAccept(p.id);
        }
    };

    return (
        <Panel className="border-blue-200 overflow-hidden rounded-sm shadow-sm">
            <div className="bg-blue-50 px-4 py-3 flex items-center justify-between border-b border-blue-200">
                <div className="flex items-center gap-2">
                    <FileText className="text-blue-600" size={18} />
                    <span className="font-medium text-blue-900">OCR Suggestions</span>
                    <span className="text-sm text-blue-600">({proposals.length} pending)</span>
                </div>
                {canBulkAccept && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkAccept}
                        disabled={!!isResolving}
                        className="text-xs"
                    >
                        <CheckCircle2 size={14} className="mr-1" />
                        Accept all safe ({safeProposals.length})
                    </Button>
                )}
            </div>

            <div className="divide-y divide-gray-100">
                {(Object.entries(grouped) as [string, PendingProposal[]][]).map(([entityType, entityProposals]) => (
                    <div key={entityType} className="p-4">
                        <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">
                            {entityType.replace('_', ' ')}
                        </p>
                        <div className="space-y-3">
                            {entityProposals.map(proposal => (
                                <div
                                    key={proposal.id}
                                    className={`border rounded-sm p-3 ${proposal.severity === 'high' ? 'border-red-200 bg-red-50/50' :
                                        proposal.confidence < 0.8 ? 'border-amber-200 bg-amber-50/50' :
                                            'border-gray-200'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <span className="font-medium text-gray-900">{getFieldLabel(proposal.fieldKey)}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                {getSeverityBadge(proposal.severity)}
                                                <span className={`text-xs ${getConfidenceColor(proposal.confidence)}`}>
                                                    {Math.round(proposal.confidence * 100)}% confidence
                                                </span>
                                            </div>
                                        </div>
                                        {proposal.sourceAnchor?.snippet && (
                                            <span className="text-xs text-gray-400 italic max-w-[200px] truncate">
                                                "{proposal.sourceAnchor.snippet}"
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Current</p>
                                            <p className="font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                {formatValue(proposal.currentValue)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Proposed</p>
                                            <p className="font-mono text-green-700 bg-green-50 px-2 py-1 rounded">
                                                {formatValue(proposal.proposedValue)}
                                            </p>
                                        </div>
                                    </div>

                                    {rejectingId === proposal.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                placeholder={proposal.severity === 'high' ? 'Reason required...' : 'Reason (optional)'}
                                                value={rejectReason}
                                                onChange={e => setRejectReason(e.target.value)}
                                                className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                                            />
                                            <button
                                                onClick={() => handleRejectConfirm(proposal.id, proposal.severity)}
                                                disabled={proposal.severity === 'high' && !rejectReason.trim()}
                                                className="px-3 py-1 bg-red-600 text-white text-sm rounded disabled:opacity-50"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => { setRejectingId(null); setRejectReason(''); }}
                                                className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => onAccept(proposal.id)}
                                                disabled={isResolving === proposal.id}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                                            >
                                                {isResolving === proposal.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <CheckCircle2 size={14} />
                                                )}
                                                Accept
                                            </button>
                                            <button
                                                onClick={() => setRejectingId(proposal.id)}
                                                disabled={!!isResolving}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 disabled:opacity-50"
                                            >
                                                <AlertCircle size={14} />
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    );
};

// =============================================================================
// MAIN PAGE
// =============================================================================

export const StudyPermitPage: React.FC<StudyPermitPageProps> = ({
    applicationId,
    orgId,
}) => {
    const [data, setData] = useState<StudyPermitBootstrapResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resolvingProposalId, setResolvingProposalId] = useState<string | null>(null);
    const didAutoGenerateSlots = useRef(false);

    const evaluationContext = useEvaluationOptional();

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await spBootstrap(applicationId);
            setData(response);
        } catch (err) {
            console.error('Bootstrap error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setIsLoading(false);
        }
    }, [applicationId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const buildFormState = (payload: StudyPermitBootstrapResponse | null): StudyPermitFormState => {
        const processingContext = payload?.application.processingContext || 'INSIDE_CANADA';
        const defaultAction = processingContext === 'OUTSIDE_CANADA' ? 'APPLY' : 'EXTEND';
        const program = payload?.studyPermitAttributes?.program || {};
        const outside = payload?.studyPermitAttributes?.outsideCanadaContext || {};
        const inside = payload?.studyPermitAttributes?.insideCanadaContext || {};
        const family = payload?.studyPermitAttributes?.familyContext || {};
        const pal = payload?.studyPermitAttributes?.palTal || {};

        return {
            actionIntent: (payload?.application.actionIntent || defaultAction) as ActionIntent,
            program: {
                dliNumber: program.dliNumber || '',
                institutionName: program.institutionName || '',
                campusCity: program.campusCity || '',
                credentialLevel: program.credentialLevel || '',
                programName: program.programName || '',
                startDate: program.startDate || '',
                endDate: program.endDate || '',
                tuitionFirstYear: program.tuitionFirstYear ? String(program.tuitionFirstYear) : '',
                deliveryMode: program.deliveryMode || '',
            },
            outsideCanadaContext: {
                countryOfResidence: outside.countryOfResidence || '',
                countryOfCitizenship: outside.countryOfCitizenship || '',
            },
            insideCanadaContext: {
                currentStatusType: (inside.currentStatusType || 'STUDY_PERMIT') as StudyPermitFormState['insideCanadaContext']['currentStatusType'],
                currentStatusExpiresAt: inside.currentStatusExpiresAt || '',
                lastEntryDate: inside.lastEntryDate || '',
            },
            familyContext: {
                hasAccompanyingSpouse: Boolean(family.hasAccompanyingSpouse),
                hasAccompanyingDependents: Boolean(family.hasAccompanyingDependents),
            },
            palTal: {
                required: typeof pal.required === 'boolean'
                    ? pal.required
                    : processingContext === 'OUTSIDE_CANADA',
                provinceOrTerritory: pal.provinceOrTerritory || '',
                documentProvided: Boolean(pal.documentProvided),
            },
        };
    };

    const [formState, setFormState] = useState<StudyPermitFormState>(() => buildFormState(null));

    useEffect(() => {
        setFormState(buildFormState(data));
    }, [data]);

    useEffect(() => {
        if (!data || isUpdating || didAutoGenerateSlots.current) return;
        if (data.slots.length > 0) return;
        didAutoGenerateSlots.current = true;

        (async () => {
            try {
                await spUpdate({ applicationId });
                await loadData();
                try {
                    await evaluationContext?.refresh();
                } catch {
                    // Optional refresh
                }
            } catch (err) {
                console.error('Auto slot generation failed:', err);
            }
        })();
    }, [data, applicationId, isUpdating, loadData, evaluationContext]);

    const handleUpdate = async () => {
        if (!data) return;
        setIsUpdating(true);
        setError(null);
        try {
            const isInside = data.application.processingContext === 'INSIDE_CANADA';
            const isOutside = data.application.processingContext === 'OUTSIDE_CANADA';
            const insideStatusExpiresAt = formState.insideCanadaContext.currentStatusExpiresAt || undefined;
            const insideLastEntryDate = formState.insideCanadaContext.lastEntryDate || undefined;
            await spUpdate({
                applicationId,
                actionIntent: formState.actionIntent,
                currentStatusExpiresAt: isInside ? insideStatusExpiresAt : undefined,
                program: {
                    ...formState.program,
                    tuitionFirstYear: formState.program.tuitionFirstYear
                        ? Number(formState.program.tuitionFirstYear)
                        : undefined,
                },
                outsideCanadaContext: isOutside ? formState.outsideCanadaContext : undefined,
                insideCanadaContext: isInside ? {
                    ...formState.insideCanadaContext,
                    currentStatusExpiresAt: insideStatusExpiresAt,
                    lastEntryDate: insideLastEntryDate,
                } : undefined,
                familyContext: formState.familyContext,
                palTal: formState.palTal,
            });
            await loadData();
            try {
                await evaluationContext?.refresh();
            } catch {
                // Optional refresh
            }
        } catch (err) {
            console.error('Update error:', err);
            setError(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUpload = async (slotId: string, file: File) => {
        setUploadingSlotId(slotId);
        setError(null);
        try {
            await uploadAndAttach(orgId, applicationId, slotId, file);
            await loadData();
            try {
                await evaluationContext?.refresh();
            } catch {
                // Optional refresh
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploadingSlotId(null);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await spSubmit(applicationId);

            if (!result.success) {
                setError(`Cannot submit: ${result.blockers.map(b => b.message).join(', ')}`);
            } else {
                await loadData();
            }
        } catch (err) {
            console.error('Submit error:', err);
            setError(err instanceof Error ? err.message : 'Submit failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAcceptProposal = async (proposalId: string) => {
        setResolvingProposalId(proposalId);
        setError(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fact-proposals/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await import('../../lib/supabase')).supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
                },
                body: JSON.stringify({ proposalId, action: 'accept' }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Accept failed');
            }

            await loadData();
        } catch (err) {
            console.error('Accept error:', err);
            setError(err instanceof Error ? err.message : 'Accept failed');
        } finally {
            setResolvingProposalId(null);
        }
    };

    const handleRejectProposal = async (proposalId: string, reason: string) => {
        setResolvingProposalId(proposalId);
        setError(null);
        try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fact-proposals/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await import('../../lib/supabase')).supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
                },
                body: JSON.stringify({ proposalId, action: 'reject', reason }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Reject failed');
            }

            await loadData();
        } catch (err) {
            console.error('Reject error:', err);
            setError(err instanceof Error ? err.message : 'Reject failed');
        } finally {
            setResolvingProposalId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <AlertCircle className="mx-auto text-red-400 mb-3" size={48} />
                    <p className="text-red-600">{error}</p>
                    <Button onClick={loadData} className="mt-4">Retry</Button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-gray-500">No data available</p>
            </div>
        );
    }

    const slotsByGroup = groupSlotsByGroup(data.slots);
    const statusExpiryAt = data.studyPermitAttributes?.insideCanadaContext?.currentStatusExpiresAt ||
        data.principal?.currentStatus?.validTo ||
        data.evaluation.derived.statusExpiryAt;
    const pendingProposals = (data.pendingProposals || []) as PendingProposal[];
    const isInside = data.application.processingContext === 'INSIDE_CANADA';
    const isOutside = data.application.processingContext === 'OUTSIDE_CANADA';

    return (
        <div className="h-full flex flex-col bg-[#F9F9F7]">
            {data.application.submittedAt && (
                <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center gap-2">
                    <CheckCircle2 className="text-green-600" size={20} />
                    <span className="text-green-800 font-medium">
                        Application submitted on {formatDate(data.application.submittedAt)}
                    </span>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <StudyStatusBar
                    processingContext={data.application.processingContext}
                    actionIntent={data.application.actionIntent}
                    evaluation={data.evaluation}
                    program={data.studyPermitAttributes?.program || null}
                    statusExpiryAt={statusExpiryAt || null}
                    submittedAt={data.application.submittedAt}
                />

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-sm">
                        {error}
                    </div>
                )}

                <AlertsPanel
                    blockers={data.evaluation.blockers}
                    warnings={data.evaluation.warnings}
                    deadlines={data.evaluation.deadlines}
                />

                <Panel className="shadow-sm rounded-sm">
                    <PanelContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-semibold text-gray-900">Study Permit Configuration</h3>
                                <p className="text-sm text-gray-500">Update facts to match the case context.</p>
                            </div>
                            <Button onClick={handleUpdate} disabled={isUpdating} className="flex items-center gap-2">
                                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                Update & Regenerate Slots
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider">Action Intent</label>
                                <select
                                    value={formState.actionIntent}
                                    onChange={e => setFormState(prev => ({ ...prev, actionIntent: e.target.value as ActionIntent }))}
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    disabled={isOutside}
                                >
                                    <option value="APPLY">Apply</option>
                                    <option value="EXTEND">Extend</option>
                                    <option value="RESTORE">Restore</option>
                                </select>
                            </div>
                            {statusExpiryAt && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase tracking-wider">Current Status Expires</label>
                                    <div className="text-sm font-medium text-gray-900">
                                        {formatDate(statusExpiryAt)} ({daysUntil(statusExpiryAt)} days)
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Program</h4>
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="DLI Number"
                                    value={formState.program.dliNumber}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, dliNumber: e.target.value } }))}
                                />
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Institution Name"
                                    value={formState.program.institutionName}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, institutionName: e.target.value } }))}
                                />
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Program Name"
                                    value={formState.program.programName}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, programName: e.target.value } }))}
                                />
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Credential Level"
                                    value={formState.program.credentialLevel}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, credentialLevel: e.target.value } }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Program Dates & Delivery</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                        value={formState.program.startDate}
                                        onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, startDate: e.target.value } }))}
                                    />
                                    <input
                                        type="date"
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                        value={formState.program.endDate}
                                        onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, endDate: e.target.value } }))}
                                    />
                                </div>
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Campus City"
                                    value={formState.program.campusCity}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, campusCity: e.target.value } }))}
                                />
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Tuition (first year)"
                                    value={formState.program.tuitionFirstYear}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, tuitionFirstYear: e.target.value } }))}
                                />
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Delivery Mode"
                                    value={formState.program.deliveryMode}
                                    onChange={e => setFormState(prev => ({ ...prev, program: { ...prev.program, deliveryMode: e.target.value } }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">PAL/TAL</h4>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={formState.palTal.required}
                                        onChange={e => setFormState(prev => ({ ...prev, palTal: { ...prev.palTal, required: e.target.checked } }))}
                                    />
                                    PAL/TAL required
                                </label>
                                <input
                                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                    placeholder="Province or Territory"
                                    value={formState.palTal.provinceOrTerritory}
                                    onChange={e => setFormState(prev => ({ ...prev, palTal: { ...prev.palTal, provinceOrTerritory: e.target.value } }))}
                                />
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={formState.palTal.documentProvided}
                                        onChange={e => setFormState(prev => ({ ...prev, palTal: { ...prev.palTal, documentProvided: e.target.checked } }))}
                                    />
                                    PAL/TAL document provided
                                </label>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Family Context</h4>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={formState.familyContext.hasAccompanyingSpouse}
                                        onChange={e => setFormState(prev => ({ ...prev, familyContext: { ...prev.familyContext, hasAccompanyingSpouse: e.target.checked } }))}
                                    />
                                    Has accompanying spouse
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={formState.familyContext.hasAccompanyingDependents}
                                        onChange={e => setFormState(prev => ({ ...prev, familyContext: { ...prev.familyContext, hasAccompanyingDependents: e.target.checked } }))}
                                    />
                                    Has accompanying dependents
                                </label>
                            </div>
                        </div>

                        {isOutside && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Outside Canada Context</h4>
                                    <input
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm mb-2"
                                        placeholder="Country of Residence"
                                        value={formState.outsideCanadaContext.countryOfResidence}
                                        onChange={e => setFormState(prev => ({ ...prev, outsideCanadaContext: { ...prev.outsideCanadaContext, countryOfResidence: e.target.value } }))}
                                    />
                                    <input
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                        placeholder="Country of Citizenship"
                                        value={formState.outsideCanadaContext.countryOfCitizenship}
                                        onChange={e => setFormState(prev => ({ ...prev, outsideCanadaContext: { ...prev.outsideCanadaContext, countryOfCitizenship: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        )}

                        {isInside && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Inside Canada Context</h4>
                                    <select
                                        value={formState.insideCanadaContext.currentStatusType}
                                        onChange={e => setFormState(prev => ({
                                            ...prev,
                                            insideCanadaContext: { ...prev.insideCanadaContext, currentStatusType: e.target.value as StudyPermitFormState['insideCanadaContext']['currentStatusType'] }
                                        }))}
                                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm mb-2"
                                    >
                                        <option value="STUDY_PERMIT">Study Permit</option>
                                        <option value="VISITOR">Visitor</option>
                                        <option value="WORK_PERMIT">Work Permit</option>
                                    </select>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                            value={formState.insideCanadaContext.currentStatusExpiresAt}
                                            onChange={e => setFormState(prev => ({
                                                ...prev,
                                                insideCanadaContext: { ...prev.insideCanadaContext, currentStatusExpiresAt: e.target.value }
                                            }))}
                                        />
                                        <input
                                            type="date"
                                            className="w-full border border-gray-200 rounded px-2 py-1 text-sm"
                                            value={formState.insideCanadaContext.lastEntryDate}
                                            onChange={e => setFormState(prev => ({
                                                ...prev,
                                                insideCanadaContext: { ...prev.insideCanadaContext, lastEntryDate: e.target.value }
                                            }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </PanelContent>
                </Panel>

                <SuggestionsPanel
                    proposals={pendingProposals}
                    onAccept={handleAcceptProposal}
                    onReject={handleRejectProposal}
                    isResolving={resolvingProposalId}
                />

                <Panel className="shadow-sm rounded-sm">
                    <PanelContent className="p-5">
                        <div className="flex items-center mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900">Document Checklist</h3>
                                <p className="text-sm text-gray-500">Upload evidence to populate facts.</p>
                            </div>
                        </div>

                        {Array.from(slotsByGroup.entries()).map(([groupName, slots]) => (
                            <div key={groupName} className="mb-4 border border-gray-200 rounded-sm overflow-hidden">
                                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                                    {groupName}
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {slots.map(slot => (
                                        <SlotRow
                                            key={slot.id}
                                            slot={slot}
                                            onUpload={handleUpload}
                                            isUploading={uploadingSlotId === slot.id}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </PanelContent>
                </Panel>
            </div>

            <div className="bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                    {data.evaluation.isReadyToSubmit ? (
                        <span className="text-green-600 font-medium flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            Ready to submit
                        </span>
                    ) : (
                        <span className="text-amber-600 flex items-center gap-2">
                            <AlertCircle size={16} />
                            {data.evaluation.blockers.length} blocker(s) remaining
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={loadData}>
                        <RefreshCw size={16} className="mr-2" />
                        Refresh
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!data.evaluation.isReadyToSubmit || isSubmitting || !!data.application.submittedAt}
                        className="flex items-center gap-2"
                        title={!data.evaluation.isReadyToSubmit ? 'Resolve blockers to submit' : undefined}
                    >
                        {isSubmitting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                        {data.application.submittedAt ? 'Already Submitted' : 'Submit Application'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default StudyPermitPage;
