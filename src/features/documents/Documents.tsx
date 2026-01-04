import React, { useEffect, useState, useRef } from 'react';
import {
    Download,
    Upload,
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    Lock,
    Link2,
    ChevronDown,
    X,
    Eye,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui';
import { useCase } from '../../context/CaseContext';
import { useEvaluation } from '../../context/EvaluationContext';
import { useDocumentActions } from './useDocumentActions';
import { spUpdate } from '../../services/spClient';

// Types
export type SlotStatus = 'missing' | 'locked' | 'uploaded' | 'in_review' | 'verified' | 'rejected';

export interface DocumentSlot {
    id: string;
    label: string;
    group: string;
    required: boolean;
    role: 'applicant' | 'spouse' | 'employer' | 'child';
    documentType: string;
    status: SlotStatus;
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    uploadedAt?: string;
    uploadedBy?: string;
    lockMessage?: string;
    rejectionReason?: string;
    expiryDate?: string;
    previewUrl?: string;
    mimeType?: string;
}

export interface DocumentGroup {
    id: string;
    title: string;
    slots: DocumentSlot[];
}

// Static config is now in src/config/documentRules.ts

// Status pill component
const StatusPill = ({ status }: { status: SlotStatus }) => {
    const config: Record<SlotStatus, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
        missing: { bg: 'bg-white border-red-600', text: 'text-red-600', icon: <AlertCircle size={12} />, label: 'MISSING' },
        locked: { bg: 'bg-gray-100 border-gray-400', text: 'text-gray-600', icon: <Lock size={12} />, label: 'LOCKED' },
        uploaded: { bg: 'bg-white border-blue-600', text: 'text-blue-600', icon: <Upload size={12} />, label: 'UPLOADED' },
        in_review: { bg: 'bg-white border-orange-500', text: 'text-orange-600', icon: <Clock size={12} />, label: 'IN REVIEW' },
        verified: { bg: 'bg-white border-green-600', text: 'text-green-600', icon: <CheckCircle2 size={12} />, label: 'VERIFIED' },
        rejected: { bg: 'bg-black border-red-600', text: 'text-red-500', icon: <X size={12} />, label: 'REJECTED' },
    };
    const c = config[status] || config.missing;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider border ${c.bg} ${c.text}`}>
            {c.icon} {c.label}
        </span>
    );
};

interface SlotRowProps {
    slot: DocumentSlot;
    isSelected: boolean;
    onSelect: () => void;
    onUpload: (file: File) => Promise<void> | void;
    isUploading?: boolean;
}

// Single slot row
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
        if (slot.status !== 'locked' && !isUploading) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file);
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
                        <span className={`text-[10px] font-mono uppercase ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                            {slot.role}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {!isSelected && <StatusPill status={slot.status} />}
                {slot.status !== 'locked' && (
                    <>
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
                            {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

interface GroupCardProps {
    group: DocumentGroup;
    selectedSlotId: string | null;
    onSelectSlot: (id: string) => void;
    onUpload: (slotId: string, file: File) => Promise<void> | void;
    uploadingSlotId?: string | null;
}

// Group card
const GroupCard: React.FC<GroupCardProps> = ({
    group,
    selectedSlotId,
    onSelectSlot,
    onUpload,
    uploadingSlotId
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const verifiedCount = group.slots.filter(s => s.status === 'verified').length;
    const requiredCount = group.slots.filter(s => s.required && s.status !== 'locked').length;

    return (
        <div className="bg-white rounded-sm border border-gray-200 overflow-hidden shadow-sm">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wide">{group.title}</h3>
                    <span className="text-xs font-mono text-gray-500">
                        [{verifiedCount}/{requiredCount}] verified
                    </span>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
            </button>
            {isExpanded && (
                <div className="p-2 space-y-1">
                    {group.slots.map(slot => (
                        <SlotRow
                            key={slot.id}
                            slot={slot}
                            isSelected={selectedSlotId === slot.id}
                            onSelect={() => onSelectSlot(slot.id)}
                            onUpload={(file) => void onUpload(slot.id, file)}
                            isUploading={uploadingSlotId === slot.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Instant Preview Popup
const InstantPreviewPopup = ({ slot, onClose }: { slot: DocumentSlot; onClose: () => void }) => {
    return (
        <div className="absolute bottom-4 right-4 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-sm font-bold text-gray-800">Upload Complete</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="p-4">
                <div className="aspect-[4/3] bg-gray-100 rounded border border-gray-200 mb-3 flex items-center justify-center overflow-hidden relative">
                    {slot.previewUrl ? (
                        slot.mimeType?.startsWith('image/') ? (
                            <img src={slot.previewUrl} alt="Preview" className="w-full h-full object-contain" />
                        ) : slot.mimeType === 'application/pdf' ? (
                            <iframe src={`${slot.previewUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full" title="PDF Preview" />
                        ) : (
                            <FileText size={48} className="text-gray-300" />
                        )
                    ) : (
                        <div className="animate-pulse bg-gray-200 w-full h-full" />
                    )}
                </div>

                <div className="space-y-1">
                    <h4 className="text-sm font-bold text-gray-900 truncate">{slot.label}</h4>
                    <p className="text-xs text-gray-500 truncate">{slot.fileName}</p>
                </div>
            </div>
        </div>
    );
};

// Preview pane
const PreviewPane = ({
    slot,
    onUpload,
    onRemove,
    isUploading
}: {
    slot: DocumentSlot | null;
    onUpload: (file: File) => Promise<void> | void;
    onRemove: () => void;
    isUploading: boolean;
}) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    if (!slot) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <Eye size={40} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Select a document slot to preview</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold text-sm text-gray-900 uppercase tracking-wide">{slot.label}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <StatusPill status={slot.status} />
                    <span className={`text-[10px] px-1.5 py-0.5 font-mono uppercase tracking-wider font-bold rounded-sm ${slot.required
                        ? 'text-red-600 border border-red-600 bg-red-50'
                        : 'text-gray-500 border border-gray-200 bg-gray-50'
                        }`}>
                        {slot.required ? 'REQUIRED' : 'OPTIONAL'}
                    </span>
                </div>
            </div>

            {/* Preview area */}
            <div className="flex-1 p-4 bg-gray-50 overflow-auto">
                {slot.status === 'locked' ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-400">
                            <Lock size={32} className="mx-auto mb-2" />
                            <p className="text-sm font-medium">Locked</p>
                            <p className="text-xs mt-1">{slot.lockMessage}</p>
                        </div>
                    </div>
                ) : slot.status === 'missing' ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
                                <Upload size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">No file uploaded</p>
                            <p className="text-xs text-gray-400 mt-1">Upload or link a document</p>
                            <div className="flex gap-2 justify-center mt-4">
                                <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>Upload</Button>
                                <Button variant="white" size="sm" icon={<Link2 size={14} />} disabled>Link Existing</Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 overflow-hidden">
                        {slot.previewUrl ? (
                            slot.mimeType?.startsWith('image/') ? (
                                <img
                                    src={slot.previewUrl}
                                    alt="Document Preview"
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : slot.mimeType === 'application/pdf' ? (
                                <iframe
                                    src={`${slot.previewUrl}#toolbar=0&navpanes=0`}
                                    className="w-full h-full border-none"
                                    title="PDF Preview"
                                />
                            ) : (
                                <div className="text-center p-8">
                                    <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm font-medium">{slot.fileName || 'document.file'}</p>
                                    <p className="text-xs text-gray-400 mt-1 mb-4">
                                        {slot.fileSize ? `${(slot.fileSize / 1024).toFixed(1)} KB` : 'Size unknown'}
                                    </p>
                                    <a
                                        href={slot.previewUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                                    >
                                        <Download size={14} /> Download File
                                    </a>
                                </div>
                            )
                        ) : (
                            <div className="text-center p-8">
                                <FileText size={48} className="mx-auto mb-3 text-gray-300" />
                                <p className="text-sm font-medium">{slot.fileName || 'document.pdf'}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {slot.fileSize ? `${(slot.fileSize / 1024).toFixed(1)} KB` : 'Size unknown'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Metadata & Actions */}
            {slot.status !== 'locked' && slot.status !== 'missing' && (
                <div className="p-4 border-t border-gray-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-gray-400">Uploaded by</span>
                            <p className="font-medium">{slot.uploadedBy || 'Unknown'}</p>
                        </div>
                        <div>
                            <span className="text-gray-400">Uploaded at</span>
                            <p className="font-medium">{slot.uploadedAt ? new Date(slot.uploadedAt).toLocaleDateString() : 'Unknown'}</p>
                        </div>
                    </div>

                    {slot.status === 'rejected' && slot.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-xs font-medium text-red-800">Rejection Reason:</p>
                            <p className="text-xs text-red-700 mt-1">{slot.rejectionReason}</p>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            variant="white"
                            size="sm"
                            icon={<RefreshCw size={14} />}
                            className="flex-1"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                        >
                            Replace
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    void onUpload(file);
                                }
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                        />
                        <Button
                            variant="white"
                            size="sm"
                            icon={<Trash2 size={14} />}
                            className="text-red-600"
                            onClick={onRemove}
                            disabled={isUploading}
                        >
                            Remove
                        </Button>
                    </div>
                </div>
            )}

            {/* Notes section */}
            <div className="p-4 border-t border-gray-200">
                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Internal Notes</h4>
                <textarea
                    className="w-full text-xs p-2 border border-gray-200 rounded-lg resize-none"
                    rows={3}
                    placeholder="Add notes about this document..."
                />
            </div>
        </div>
    );
};

interface DocumentsProps {
    caseTitle?: string;
    applicationType?: string;
}

const Documents: React.FC<DocumentsProps> = ({ caseTitle, applicationType }) => {
    const { caseData, computedDocuments, saveDocument, removeDocument, documentsLoading } = useCase();
    const { documentGroups, isLoading: evaluationLoading, refresh } = useEvaluation();
    const { uploadDocument, removeDocument: removeNewDoc } = useDocumentActions();

    const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
    const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
    const didAutoGenerateSlots = useRef(false);

    const rawAppType = caseData?.raw?.app_type as string | undefined;
    const appTypeLabel = caseData?.appType || applicationType || '';
    const isStudyPermit = rawAppType === 'STUDY_PERMIT' || appTypeLabel.toLowerCase().includes('study permit');
    const usesNewDocs = Boolean(caseData?.raw?.uses_new_docs) || isStudyPermit;
    const applicationId = caseData?.id ? String(caseData.id) : '';
    const orgId =
        (caseData as any)?.raw?.org_id ||
        (caseData as any)?.raw?.orgId ||
        '';

    const groups: DocumentGroup[] = usesNewDocs
        ? documentGroups.map(group => ({
            id: group.id,
            title: group.title,
            slots: group.slots.map(slot => ({
                id: slot.id,
                label: slot.label,
                group: group.id,
                required: slot.required,
                role: slot.role,
                documentType: slot.documentType,
                status: slot.status,
                fileId: slot.fileId,
                fileName: slot.fileName,
                fileSize: slot.fileSize,
                uploadedAt: slot.uploadedAt,
                uploadedBy: slot.uploadedBy,
                lockMessage: slot.lockMessage,
                rejectionReason: slot.rejectionReason,
                expiryDate: slot.expiryDate,
                previewUrl: slot.previewUrl,
                mimeType: slot.mimeType,
            }))
        }))
        : computedDocuments;

    const allSlots = groups.flatMap(group => group.slots);
    const selectedSlot = allSlots.find(slot => slot.id === selectedSlotId) || null;

    useEffect(() => {
        if (selectedSlotId && selectedSlot) return;
        if (allSlots.length > 0) {
            setSelectedSlotId(allSlots[0].id);
        } else {
            setSelectedSlotId(null);
        }
    }, [allSlots, selectedSlot, selectedSlotId]);

    useEffect(() => {
        if (!usesNewDocs || evaluationLoading || didAutoGenerateSlots.current) return;
        if (!applicationId || groups.length > 0) return;

        const rawAppType = caseData?.raw?.app_type as string | undefined;
        const isStudyPermit = rawAppType === 'STUDY_PERMIT' ||
            (caseData?.appType || '').toLowerCase().includes('study permit');

        if (!isStudyPermit) return;
        didAutoGenerateSlots.current = true;

        (async () => {
            try {
                await spUpdate({ applicationId });
                await refresh();
            } catch (err) {
                console.error('Failed to bootstrap study permit slots:', err);
            }
        })();
    }, [usesNewDocs, evaluationLoading, applicationId, groups.length, caseData, refresh]);

    const handleUpload = async (slotId: string, file: File) => {
        setUploadingSlotId(slotId);
        try {
            if (usesNewDocs) {
                if (!applicationId || !orgId) {
                    throw new Error('Missing application or organization ID.');
                }
                await uploadDocument(slotId, file, {
                    applicationId,
                    orgId,
                    usesNewDocs: true,
                });
            } else {
                await saveDocument(slotId, file);
            }
        } finally {
            setUploadingSlotId(null);
        }
    };

    const handleRemove = async (slotId: string) => {
        if (usesNewDocs) {
            if (!applicationId || !orgId) return;
            await removeNewDoc(slotId, { applicationId, orgId });
        } else {
            await removeDocument(slotId);
        }
    };

    const isLoading = usesNewDocs ? evaluationLoading : documentsLoading;
    const displayTitle = caseTitle || 'Documents';
    const displayType = applicationType || 'Application';

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="flex items-center gap-2 text-gray-500">
                    <RefreshCw size={16} className="animate-spin" />
                    Loading documents…
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-[#F9F9F7]">
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Documents</h1>
                    <p className="text-sm text-gray-500">{displayTitle} · {displayType}</p>
                </div>
                <div className="flex items-center gap-3">
                    {caseData?.status && <StatusBadge status={caseData.status} />}
                    <span className="text-xs font-mono text-gray-400">
                        {usesNewDocs ? 'NEW DOCS' : 'LEGACY DOCS'}
                    </span>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">
                <div className="col-span-7 space-y-4 overflow-y-auto">
                    {groups.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <FileText size={40} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No document slots available.</p>
                            </div>
                        </div>
                    ) : (
                        groups.map(group => (
                            <GroupCard
                                key={group.id}
                                group={group}
                                selectedSlotId={selectedSlotId}
                                onSelectSlot={setSelectedSlotId}
                                onUpload={handleUpload}
                                uploadingSlotId={uploadingSlotId}
                            />
                        ))
                    )}
                </div>

                <div className="col-span-5 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <PreviewPane
                        slot={selectedSlot}
                        onUpload={(file) => {
                            if (!selectedSlot) return;
                            return handleUpload(selectedSlot.id, file);
                        }}
                        onRemove={() => {
                            if (!selectedSlot) return;
                            void handleRemove(selectedSlot.id);
                        }}
                        isUploading={uploadingSlotId === selectedSlot?.id}
                    />
                </div>
            </div>
        </div>
    );
};

export default Documents;
