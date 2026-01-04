/**
 * WP Extend Page
 * 
 * Pure renderer for Work Permit Inside Canada Extension.
 * ALL data comes from wpBootstrap Edge Function.
 * ALL mutations go through wpUpdate/attachFile/wpSubmit Edge Functions.
 * NO direct Supabase calls in this file.
 */

import React, { useEffect, useState, useCallback, useContext } from 'react';
import {
    AlertTriangle,
    AlertCircle,
    Clock,
    CheckCircle2,
    Shield,
    Calendar,
    Upload,
    FileText,
    ChevronDown,
    ChevronRight,
    Loader2,
    Send,
    RefreshCw,
    Eye,
    X,
    Lock
} from 'lucide-react';
import { Button, Panel, PanelContent } from '../../components/ui';
import {
    wpBootstrap,
    wpUpdate,
    wpSubmit,
    uploadAndAttach,
    groupSlotsByGroup,
    formatDate,
    daysUntil,
    type WorkPermitBootstrapResponse,
    type SlotWithDocument,
    type Evaluation,
    type Deadline,
    type Blocker,
    type ProgramType,
    type AuthorizationModel,
    type SlotState
} from '../../services/wpClient';
import { useEvaluationOptional } from '../../context/EvaluationContext';

// =============================================================================
// TYPES
// =============================================================================

interface WPExtendPageProps {
    applicationId: string;
    orgId: string;
    onBack?: () => void;
}

// =============================================================================
// STATUS PILL (Matching Documents.tsx)
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
// STATUS BAR COMPONENT
// =============================================================================

interface StatusBarProps {
    evaluation: Evaluation;
    statusExpiryAt: string | null;
    submittedAt: string | null;
    isMaintainedStatusEligible: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({
    evaluation,
    statusExpiryAt,
    submittedAt,
    isMaintainedStatusEligible
}) => {
    const daysLeft = daysUntil(statusExpiryAt);

    const getExpiryColor = () => {
        if (daysLeft === null) return 'bg-gray-100 text-gray-600';
        if (daysLeft <= 7) return 'bg-red-100 text-red-700';
        if (daysLeft <= 14) return 'bg-amber-100 text-amber-700';
        if (daysLeft <= 30) return 'bg-yellow-100 text-yellow-700';
        return 'bg-green-100 text-green-700';
    };

    return (
        <Panel className="rounded-sm shadow-sm">
            <PanelContent>
                <div className="flex items-center justify-between">
                    {/* Status Expiry */}
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current Status Expires</p>
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm ${getExpiryColor()}`}>
                                <Calendar size={16} />
                                <span className="font-semibold">
                                    {statusExpiryAt ? formatDate(statusExpiryAt) : 'Not Set'}
                                </span>
                                {daysLeft !== null && (
                                    <span className="text-sm">({daysLeft} days left)</span>
                                )}
                            </div>
                        </div>

                        {/* Recommended Submit By */}
                        {evaluation.derived.recommendedApplyBy && (
                            <div>
                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Apply By</p>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-sm">
                                    <Clock size={16} />
                                    <span className="font-medium">{formatDate(evaluation.derived.recommendedApplyBy)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Maintained Status Indicator */}
                    <div className="flex items-center gap-4">
                        {submittedAt ? (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-sm ${isMaintainedStatusEligible
                                ? 'bg-green-100 text-green-700'
                                : 'bg-amber-100 text-amber-700'
                                }`}>
                                <Shield size={18} />
                                <span className="font-medium">
                                    {isMaintainedStatusEligible
                                        ? 'Maintained Status Eligible'
                                        : 'Restoration May Be Required'}
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 rounded-sm">
                                <Clock size={18} />
                                <span className="font-medium">Not Yet Submitted</span>
                            </div>
                        )}
                    </div>
                </div>
            </PanelContent>
        </Panel>
    );
};

// =============================================================================
// BLOCKERS & WARNINGS PANEL
// =============================================================================

interface AlertsPanelProps {
    blockers: Blocker[];
    warnings: Evaluation['warnings'];
    deadlines: Deadline[];
    onNavigateToSlot?: (slotId: string) => void;
    onUpload?: (slotId: string, file: File) => Promise<void>;
    uploadingSlotId?: string | null;
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({
    blockers,
    warnings,
    deadlines,
    onNavigateToSlot,
    onUpload,
    uploadingSlotId
}) => {
    if (blockers.length === 0 && warnings.length === 0 && deadlines.length === 0) {
        return null;
    }

    const criticalDeadlines = deadlines.filter(d => d.severity === 'critical');
    const warningDeadlines = deadlines.filter(d => d.severity === 'warning');

    return (
        <Panel>
            <PanelContent className="space-y-3">
                {/* Critical Deadlines */}
                {criticalDeadlines.map(deadline => (
                    <div key={deadline.key} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-red-600 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <AlertTriangle className="text-red-600 shrink-0" size={20} />
                        <span className="text-gray-900 font-medium">{deadline.message}</span>
                    </div>
                ))}

                {/* Blockers - with upload button for missing documents */}
                {blockers.map((blocker, idx) => (
                    <BlockerRow
                        key={idx}
                        blocker={blocker}
                        onNavigateToSlot={onNavigateToSlot}
                        onUpload={onUpload}
                        isUploading={uploadingSlotId === blocker.slotId}
                    />
                ))}

                {/* Warning Deadlines */}
                {warningDeadlines.map(deadline => (
                    <div key={deadline.key} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-orange-500 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <Clock className="text-orange-500 shrink-0" size={20} />
                        <span className="text-gray-900">{deadline.message}</span>
                    </div>
                ))}

                {/* Warnings */}
                {warnings.map((warning, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border-l-4 border-l-orange-500 border-y border-r border-gray-200 rounded-sm shadow-sm">
                        <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                        <span className="text-gray-900">{warning.message}</span>
                    </div>
                ))}
            </PanelContent>
        </Panel>
    );
};

// BlockerRow component with inline upload button
interface BlockerRowProps {
    blocker: Blocker;
    onNavigateToSlot?: (slotId: string) => void;
    onUpload?: (slotId: string, file: File) => Promise<void>;
    isUploading: boolean;
}

const BlockerRow: React.FC<BlockerRowProps> = ({
    blocker,
    onNavigateToSlot,
    onUpload,
    isUploading
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const isMissingDoc = blocker.code === 'MISSING_REQUIRED_DOC' && blocker.slotId;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && blocker.slotId && onUpload) {
            await onUpload(blocker.slotId, file);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div
            className={`flex items-center justify-between p-3 bg-white border-l-4 border-l-red-600 border-y border-r border-gray-200 rounded-sm shadow-sm ${blocker.slotId && !isMissingDoc ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
            onClick={() => !isMissingDoc && blocker.slotId && onNavigateToSlot?.(blocker.slotId)}
        >
            <div className="flex items-center gap-3">
                <AlertCircle className="text-red-600 shrink-0" size={20} />
                <span className="text-gray-900 font-medium">{blocker.message}</span>
            </div>
            <div className="flex items-center gap-2">
                {/* Upload button for missing documents */}
                {isMissingDoc && onUpload && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                            accept=".pdf,.jpg,.jpeg,.png"
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-3 py-1.5 bg-black border border-black rounded-sm text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <Upload size={14} />
                                    Upload
                                </>
                            )}
                        </button>
                    </>
                )}
                {blocker.slotId && !isMissingDoc && <ChevronRight className="text-gray-400" size={16} />}
            </div>
        </div>
    );
};

// =============================================================================
// SLOT ROW COMPONENT (Replacing SlotCard to match Documents.tsx)
// =============================================================================

interface SlotRowProps {
    slot: SlotWithDocument;
    isSelected: boolean;
    onSelect: () => void;
    onUpload: (file: File) => Promise<void>;
    isUploading: boolean;
}

const SlotRow: React.FC<SlotRowProps> = ({
    slot,
    isSelected,
    onSelect,
    onUpload,
    isUploading
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUploadClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onUpload(file);
        }
    };

    return (
        <div
            onClick={onSelect}
            className={`flex items-center justify-between p-3 rounded-sm border-b border-gray-100 cursor-pointer transition-all ${isSelected
                ? 'bg-black text-white border-black'
                : 'hover:bg-gray-50'
                }`}
        >
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText size={16} className={isSelected ? 'text-white' : 'text-gray-400'} />
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {slot.label}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase tracking-wider font-bold rounded-sm ${slot.required
                            ? isSelected ? 'bg-red-600 text-white border border-red-600' : 'text-red-600 border border-red-600 bg-red-50'
                            : isSelected ? 'border border-white/40 text-white/70' : 'text-gray-500 border border-gray-200 bg-gray-50'
                            }`}>
                            {slot.required ? 'REQUIRED' : 'OPTIONAL'}
                        </span>
                        {/* Scope/Role indicator */}
                        <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                            {slot.scope}
                        </span>
                    </div>
                    {slot.document && (
                        <div className={`text-xs mt-1 truncate font-mono ${isSelected ? 'text-white/70' : 'text-gray-500'}`}>
                            {slot.document.fileName}
                        </div>
                    )}
                    {slot.meta?.rejectionReason && (
                        <div className="text-xs text-red-400 mt-1">
                            Rejected: {slot.meta.rejectionReason}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {!isSelected && <StatusPill status={slot.state} />}

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
                    className={`p-1.5 rounded-sm transition-colors ${isSelected
                        ? 'hover:bg-white/10 text-white'
                        : 'hover:bg-gray-100 text-gray-500'
                        }`}
                >
                    {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                </button>

                {slot.document?.previewUrl && (
                    <a
                        href={slot.document.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className={`p-1.5 rounded-sm transition-colors ${isSelected
                            ? 'hover:bg-white/10 text-white'
                            : 'hover:bg-gray-100 text-gray-500'
                            }`}
                    >
                        <Eye size={14} />
                    </a>
                )}
            </div>
        </div>
    );
};

// =============================================================================
// CHECKLIST SECTION (Matching GroupCard in Documents.tsx)
// =============================================================================

interface ChecklistSectionProps {
    title: string;
    slots: SlotWithDocument[];
    selectedSlotId: string | null;
    onSelectSlot: (id: string) => void;
    onUpload: (slotId: string, file: File) => Promise<void>;
    uploadingSlotId: string | null;
    defaultExpanded?: boolean;
}

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
    title,
    slots,
    selectedSlotId,
    onSelectSlot,
    onUpload,
    uploadingSlotId,
    defaultExpanded = true
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const completedCount = slots.filter(s => s.state === 'verified' || s.state === 'uploaded').length;
    const totalRequired = slots.filter(s => s.required).length;

    return (
        <div className="bg-white rounded-sm border border-gray-200 overflow-hidden shadow-sm">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wide">{title}</h3>
                    <span className="text-xs font-mono text-gray-500">
                        [{completedCount}/{totalRequired}]
                    </span>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </button>
            {isExpanded && (
                <div className="p-2 space-y-1">
                    {slots.map(slot => (
                        <SlotRow
                            key={slot.id}
                            slot={slot}
                            isSelected={selectedSlotId === slot.id}
                            onSelect={() => onSelectSlot(slot.id)}
                            onUpload={file => onUpload(slot.id, file)}
                            isUploading={uploadingSlotId === slot.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// =============================================================================
// CONFIGURATION PANEL
// =============================================================================

interface ConfigPanelProps {
    programType: ProgramType | null;
    authorizationModel: AuthorizationModel | null;
    statusExpiryAt: string | null;
    authorizationArtifactRefNumber: string | null;
    openBasisCode: string | null;
    onUpdate: (updates: {
        programType?: ProgramType;
        authorizationModel?: AuthorizationModel;
        currentStatusExpiresAt?: string;
        authorizationArtifact?: {
            kind?: 'LMIA' | 'EMPLOYER_PORTAL_OFFER';
            refNumber?: string;
        };
        openBasis?: {
            basisCode?: string;
        };
    }) => Promise<void>;
    isUpdating: boolean;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({
    programType,
    authorizationModel,
    statusExpiryAt,
    authorizationArtifactRefNumber,
    openBasisCode,
    onUpdate,
    isUpdating
}) => {
    const [localProgramType, setLocalProgramType] = useState(programType);
    const [localAuthModel, setLocalAuthModel] = useState(authorizationModel);
    const [localExpiry, setLocalExpiry] = useState(statusExpiryAt || '');
    const [localOfferNumber, setLocalOfferNumber] = useState(authorizationArtifactRefNumber || '');
    const [localOpenBasis, setLocalOpenBasis] = useState(openBasisCode || '');

    // Reset local state when props change (after bootstrap refresh)
    useEffect(() => {
        setLocalProgramType(programType);
        setLocalAuthModel(authorizationModel);
        setLocalExpiry(statusExpiryAt || '');
        setLocalOfferNumber(authorizationArtifactRefNumber || '');
        setLocalOpenBasis(openBasisCode || '');
    }, [programType, authorizationModel, statusExpiryAt, authorizationArtifactRefNumber, openBasisCode]);

    const hasChanges =
        localProgramType !== programType ||
        localAuthModel !== authorizationModel ||
        localExpiry !== (statusExpiryAt || '') ||
        localOfferNumber !== (authorizationArtifactRefNumber || '') ||
        localOpenBasis !== (openBasisCode || '');

    const handleSave = async () => {
        let nextAuthorizationArtifact: {
            kind?: 'LMIA' | 'EMPLOYER_PORTAL_OFFER';
            refNumber?: string;
        } | undefined;

        if (localAuthModel === 'EMPLOYER_SPECIFIC' && localOfferNumber.trim()) {
            nextAuthorizationArtifact = {
                refNumber: localOfferNumber.trim(),
            };
            if (localProgramType === 'TFWP') {
                nextAuthorizationArtifact.kind = 'LMIA';
            } else if (localProgramType === 'IMP') {
                nextAuthorizationArtifact.kind = 'EMPLOYER_PORTAL_OFFER';
            }
        }

        const nextOpenBasis =
            localAuthModel === 'OPEN' && localOpenBasis.trim()
                ? { basisCode: localOpenBasis.trim() }
                : undefined;

        await onUpdate({
            programType: localProgramType || undefined,
            authorizationModel: localAuthModel || undefined,
            currentStatusExpiresAt: localExpiry || undefined,
            authorizationArtifact: nextAuthorizationArtifact,
            openBasis: nextOpenBasis,
        });
    };

    return (
        <Panel className="space-y-4 rounded-sm shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Work Permit Configuration</h3>
            </div>

            <PanelContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Program Type</label>
                        <select
                            value={localProgramType || ''}
                            onChange={e => setLocalProgramType(e.target.value as ProgramType)}
                            className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                        >
                            <option value="">Select...</option>
                            <option value="IMP">IMP (LMIA-Exempt)</option>
                            <option value="TFWP">TFWP (LMIA-Based)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Authorization Model</label>
                        <select
                            value={localAuthModel || ''}
                            onChange={e => setLocalAuthModel(e.target.value as AuthorizationModel)}
                            className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                        >
                            <option value="">Select...</option>
                            <option value="EMPLOYER_SPECIFIC">Employer-Specific</option>
                            <option value="OPEN">Open Work Permit</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status Expiry Date</label>
                        <input
                            type="date"
                            value={localExpiry}
                            onChange={e => setLocalExpiry(e.target.value)}
                            className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                        />
                    </div>

                    {localAuthModel === 'EMPLOYER_SPECIFIC' && (
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {localProgramType === 'TFWP' ? 'LMIA Number' : 'Offer of Employment Number'}
                            </label>
                            <input
                                type="text"
                                value={localOfferNumber}
                                onChange={e => setLocalOfferNumber(e.target.value)}
                                placeholder={localProgramType === 'TFWP' ? 'LMIA number' : 'Employer Portal Offer number'}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                            />
                        </div>
                    )}

                    {localAuthModel === 'OPEN' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Open WP Basis</label>
                            <select
                                value={localOpenBasis}
                                onChange={e => setLocalOpenBasis(e.target.value)}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm"
                            >
                                <option value="">Select...</option>
                                <option value="BOWP">BOWP</option>
                                <option value="SPOUSE_WORKER">Spouse of Worker</option>
                                <option value="SPOUSE_STUDENT">Spouse of Student</option>
                                <option value="PGWP_EXTENSION">PGWP Extension</option>
                                <option value="PROTECTED_PERSON">Protected Person</option>
                                <option value="VULNERABLE_WORKER">Vulnerable Worker</option>
                            </select>
                        </div>
                    )}
                </div>

                {hasChanges && (
                    <div className="flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={isUpdating}
                            className="flex items-center gap-2"
                        >
                            {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            Update & Regenerate Slots
                        </Button>
                    </div>
                )}
            </PanelContent>
        </Panel>
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

    // Group by target entity type
    const grouped = proposals.reduce((acc, p) => {
        const key = p.targetEntityType;
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {} as Record<string, PendingProposal[]>);

    const getFieldLabel = (fieldKey: string) => {
        // Convert field.path.name to "Field Path Name"
        return fieldKey
            .split('.')
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' › ');
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
        if (val === null || val === undefined) return '—';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const handleRejectConfirm = async (proposalId: string, severity: string) => {
        if (severity === 'high' && !rejectReason.trim()) {
            return; // Require reason for high severity
        }
        await onReject(proposalId, rejectReason);
        setRejectingId(null);
        setRejectReason('');
    };

    // "Accept all safe" = confidence >= 0.9, severity != high
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
// MAIN WP EXTEND PAGE
// =============================================================================

export const WPExtendPage: React.FC<WPExtendPageProps> = ({
    applicationId,
    orgId,
}) => {
    const [data, setData] = useState<WorkPermitBootstrapResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ==========================================================================
    // LOAD DATA - Single source of truth from wp-bootstrap
    // ==========================================================================
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await wpBootstrap(applicationId);
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

    // ==========================================================================
    // UPDATE CONFIG - Via wp-update Edge Function
    // ==========================================================================
    const handleUpdate = async (updates: {
        programType?: ProgramType;
        authorizationModel?: AuthorizationModel;
        currentStatusExpiresAt?: string;
        authorizationArtifact?: {
            kind?: 'LMIA' | 'EMPLOYER_PORTAL_OFFER';
            refNumber?: string;
        };
        openBasis?: {
            basisCode?: string;
        };
    }) => {
        setIsUpdating(true);
        setError(null);
        try {
            await wpUpdate({
                applicationId,
                ...updates
            });
            // Refresh all data from bootstrap
            await loadData();
            // Refresh EvaluationContext so Documents tab sees new slots
            try {
                await evaluationContext?.refresh();
            } catch {
                // EvaluationContext refresh is optional
            }
        } catch (err) {
            console.error('Update error:', err);
            setError(err instanceof Error ? err.message : 'Update failed');
        } finally {
            setIsUpdating(false);
        }
    };

    // ==========================================================================
    // UPLOAD - Via uploadAndAttach helper
    // ==========================================================================
    // Get EvaluationContext refresh for syncing with Documents tab (optional - may be null)
    const evaluationContext = useEvaluationOptional();

    const handleUpload = async (slotId: string, file: File) => {
        setUploadingSlotId(slotId);
        setError(null);
        try {
            await uploadAndAttach(orgId, applicationId, slotId, file);
            // Refresh all data from bootstrap
            await loadData();
            // Also refresh EvaluationContext so Documents tab syncs
            try {
                await evaluationContext?.refresh();
            } catch {
                // EvaluationContext refresh is optional
            }
        } catch (err) {
            console.error('Upload error:', err);
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploadingSlotId(null);
        }
    };

    // ==========================================================================
    // SUBMIT - Via wp-submit Edge Function
    // ==========================================================================
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const result = await wpSubmit(applicationId);

            if (!result.success) {
                // Show blockers and scroll to first slot if applicable
                const firstSlotBlocker = result.blockers.find(b => b.slotId);
                if (firstSlotBlocker?.slotId) {
                    setSelectedSlotId(firstSlotBlocker.slotId);
                    // Scroll to element
                    document.getElementById(`slot-${firstSlotBlocker.slotId}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
                setError(`Cannot submit: ${result.blockers.map(b => b.message).join(', ')}`);
            } else {
                // Refresh to get updated state
                await loadData();
            }
        } catch (err) {
            console.error('Submit error:', err);
            setError(err instanceof Error ? err.message : 'Submit failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ==========================================================================
    // PROPOSAL RESOLVE - Via fact-proposals/resolve Edge Function
    // ==========================================================================
    const [resolvingProposalId, setResolvingProposalId] = useState<string | null>(null);

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

            // Refresh to get updated data
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

            // Refresh to get updated data
            await loadData();
        } catch (err) {
            console.error('Reject error:', err);
            setError(err instanceof Error ? err.message : 'Reject failed');
        } finally {
            setResolvingProposalId(null);
        }
    };

    // ==========================================================================
    // DERIVED DATA - All from bootstrap response
    // ==========================================================================
    const slotsByGroup = data ? groupSlotsByGroup(data.slots) : new Map();
    const statusExpiryAt = data?.workPermitAttributes?.insideCanadaContext?.currentStatusExpiresAt ||
        data?.principal?.currentStatus?.validTo ||
        data?.evaluation.derived.statusExpiryAt;
    const pendingProposals = (data?.pendingProposals || []) as PendingProposal[];

    // ==========================================================================
    // RENDER: Loading State
    // ==========================================================================
    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    // ==========================================================================
    // RENDER: Error State
    // ==========================================================================
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

    // ==========================================================================
    // RENDER: Main Page
    // ==========================================================================
    return (
        <div className="h-full flex flex-col bg-[#F9F9F7]">
            {/* Submitted Banner */}
            {data.application.submittedAt && (
                <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center gap-2">
                    <CheckCircle2 className="text-green-600" size={20} />
                    <span className="text-green-800 font-medium">
                        Application submitted on {formatDate(data.application.submittedAt)}
                    </span>
                </div>
            )}

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Status Bar */}
                <StatusBar
                    evaluation={data.evaluation}
                    statusExpiryAt={statusExpiryAt || null}
                    submittedAt={data.application.submittedAt}
                    isMaintainedStatusEligible={data.evaluation.derived.isMaintainedStatusEligible}
                />

                {/* Error Banner (dismissible) */}
                {error && (
                    <Panel className="bg-red-50 border-red-200">
                        <PanelContent className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="text-red-600" size={20} />
                                <span className="text-red-800">{error}</span>
                            </div>
                            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
                                ✕
                            </button>
                        </PanelContent>
                    </Panel>
                )}

                {/* Alerts Panel - Blockers/Warnings from evaluation */}
                <AlertsPanel
                    blockers={data.evaluation.blockers}
                    warnings={data.evaluation.warnings}
                    deadlines={data.evaluation.deadlines}
                    onNavigateToSlot={setSelectedSlotId}
                    onUpload={handleUpload}
                    uploadingSlotId={uploadingSlotId}
                />

                {/* Configuration */}
                <ConfigPanel
                    programType={data.workPermitAttributes?.programType || null}
                    authorizationModel={data.workPermitAttributes?.authorizationModel || null}
                    statusExpiryAt={statusExpiryAt || null}
                    authorizationArtifactRefNumber={data.workPermitAttributes?.authorizationArtifact?.refNumber || null}
                    openBasisCode={data.workPermitAttributes?.openBasis?.basisCode || null}
                    onUpdate={handleUpdate}
                    isUpdating={isUpdating}
                />

                {/* OCR Suggestions Panel */}
                <SuggestionsPanel
                    proposals={pendingProposals}
                    onAccept={handleAcceptProposal}
                    onReject={handleRejectProposal}
                    isResolving={resolvingProposalId}
                />

                {/* Checklist Sections - grouped by slot.group */}
                <div className="space-y-6">
                    {Array.from(slotsByGroup.entries()).map(([groupName, slots]) => (
                        <ChecklistSection
                            key={groupName}
                            title={groupName}
                            slots={slots}
                            selectedSlotId={selectedSlotId}
                            onSelectSlot={setSelectedSlotId}
                            onUpload={handleUpload}
                            uploadingSlotId={uploadingSlotId}
                        />
                    ))}

                    {/* Empty State - when no slots */}
                    {data.slots.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <FileText className="mx-auto mb-3 opacity-50" size={48} />
                            <p className="text-lg font-medium">No slots generated yet</p>
                            <p className="text-sm">Configure your work permit type above to generate the document checklist.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Submit Footer */}
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

export default WPExtendPage;
