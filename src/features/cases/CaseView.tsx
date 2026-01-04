import React, { useState } from 'react';
import {
    ArrowLeft,
    FileText,
    Database,
    ClipboardList,
    Activity,
    CheckSquare,
    Trash2
} from 'lucide-react';
import { StatusBadge } from '../../components/ui';
import { Workspace } from './Workspace';
import { Documents } from '../documents';
import { WPExtendPage } from './WPExtendPage';
import { StudyPermitPage } from './StudyPermitPage';
import { CaseData } from './CaseList';

import { CaseProvider } from '../../context/CaseContext';
import { EvaluationProvider, EvaluationStatusBar, ActivityLog } from '../../components/evaluation';

type CaseTab = 'data' | 'checklist' | 'documents' | 'forms' | 'activity';

interface CaseViewProps {
    caseData: CaseData;
    onBack: () => void;
    onCreateNew?: () => void;
    onEdit?: () => void;
    onDelete?: (caseData: CaseData) => Promise<void>;
}

const TAB_CONFIG: { id: CaseTab; label: string; icon: React.ElementType }[] = [
    { id: 'data', label: 'Data', icon: Database },
    { id: 'checklist', label: 'Checklist', icon: CheckSquare },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'forms', label: 'Forms', icon: ClipboardList },
    { id: 'activity', label: 'Activity', icon: Activity },
];

export const CaseView = ({ caseData, onBack, onCreateNew, onEdit, onDelete }: CaseViewProps) => {
    const [activeTab, setActiveTab] = useState<CaseTab>('data');
    const [isDeleting, setIsDeleting] = useState(false);

    // Extract IDs for evaluation context
    const applicationId = caseData.id;
    const orgId = caseData.raw?.org_id || '';
    const isStudyPermit = caseData.raw?.app_type === 'STUDY_PERMIT'
        || caseData.appType?.toLowerCase().includes('study permit');
    const usesNewDocs = caseData.raw?.uses_new_docs === true || isStudyPermit;

    return (
        <CaseProvider caseData={caseData}>
            <EvaluationProvider applicationId={applicationId} orgId={orgId} usesNewDocs={usesNewDocs}>
                <div className="h-full flex flex-col bg-[#F9F9F7]">
                    {/* Case Header */}
                    <header className="bg-white border-b border-gray-200 shrink-0">
                        <div className="flex items-center justify-between px-6 py-4">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={onBack}
                                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div className="h-6 w-px bg-gray-200" />
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900">{caseData.client.name}</h1>
                                    <p className="text-sm text-gray-500">{caseData.appType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {onDelete && (
                                    <button
                                        onClick={async () => {
                                            if (!onDelete || isDeleting) return;
                                            const confirmed = window.confirm(`Delete case for ${caseData.client.name}? This cannot be undone.`);
                                            if (!confirmed) return;
                                            setIsDeleting(true);
                                            try {
                                                await onDelete(caseData);
                                            } catch (error: any) {
                                                console.error('Delete case failed:', error);
                                                alert(error?.message || 'Failed to delete case.');
                                            } finally {
                                                setIsDeleting(false);
                                            }
                                        }}
                                        disabled={isDeleting}
                                        className="px-3 py-1.5 border border-red-200 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        {isDeleting ? 'Deleting...' : 'Delete Case'}
                                    </button>
                                )}
                                {onEdit && (
                                    <button
                                        onClick={onEdit}
                                        className="px-3 py-1.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors"
                                    >
                                        Edit Case
                                    </button>
                                )}
                                <span className="text-xs font-mono text-gray-400">
                                    Case #LM-{Date.now().toString().slice(-6)}
                                </span>
                                <StatusBadge status={caseData.status} />
                            </div>
                        </div>

                        {/* Top-level tabs */}
                        <div className="px-6 flex gap-1">
                            {TAB_CONFIG.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${isActive
                                            ? 'bg-[#F9F9F7] text-black border-t border-x border-gray-200'
                                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </header>

                    {/* Evaluation Status Bar - Shows blockers/warnings/deadlines */}
                    <EvaluationStatusBar />

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === 'data' && (
                            <Workspace caseData={caseData} onBack={() => { }} headless={true} />
                        )}

                        {activeTab === 'checklist' && (
                            isStudyPermit ? (
                                <StudyPermitPage
                                    applicationId={applicationId}
                                    orgId={orgId}
                                />
                            ) : (
                                <WPExtendPage
                                    applicationId={applicationId}
                                    orgId={orgId}
                                />
                            )
                        )}

                        {activeTab === 'documents' && (
                            <Documents
                                caseTitle={caseData.client.name}
                                applicationType={caseData.appType}
                            />
                        )}

                        {activeTab === 'forms' && (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <ClipboardList size={48} className="mx-auto mb-3 opacity-50" />
                                    <p className="text-lg font-medium">Generated Forms</p>
                                    <p className="text-sm">IMM1295, IMM5707, etc. coming soon...</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="h-full overflow-y-auto">
                                <ActivityLog />
                            </div>
                        )}
                    </div>
                </div>
            </EvaluationProvider>
        </CaseProvider>
    );
};

export default CaseView;
