
import React from 'react';
import {
    User,
    Mail,
    Briefcase,
    FileText
} from 'lucide-react';
import { useCase } from '../../context/CaseContext';
import { Button, StatusBadge } from '../../components/ui';
import { CaseList } from './CaseList';
import { useEvaluation, EvaluationPanel } from '../../components/evaluation';

export const CaseOverview = ({ onNavigate, onCreateNew }: { onNavigate: (tab: string) => void, onCreateNew?: () => void }) => {
    const { caseData, computedDocuments, formData } = useCase();
    const { evaluation, hasBlockers, hasCriticalDeadlines } = useEvaluation();

    if (!caseData) return null;

    const orgId = (caseData as any)?.raw?.org_id || '';
    const allSlots = computedDocuments.flatMap(g => g.slots);
    const requiredSlots = allSlots.filter(s => s.required && s.status !== 'locked');
    const verifiedSlots = requiredSlots.filter(s => s.status === 'verified');
    const uploadedSlots = requiredSlots.filter(s => s.status === 'uploaded');

    const docProgress = requiredSlots.length > 0
        ? Math.round(((verifiedSlots.length + uploadedSlots.length) / requiredSlots.length) * 100)
        : 0;

    // Calculate Data Progress (Simplified for MVP)
    // We check a few key fields to estimate progress
    const keyFields = [
        formData.email, formData.phone, formData.passportNum,
        formData.currentActivity, formData.spouseRelationType
    ];
    const filledFields = keyFields.filter(f => f && f !== '').length;
    const dataProgress = Math.round((filledFields / keyFields.length) * 100);

    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">

            {/* Case List */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">All Cases</h3>
                </div>
                <CaseList
                    onOpenCase={(_caseData) => { }}
                    onCreateNew={onCreateNew || (() => { })}
                    orgId={orgId}
                />
            </div>

            {/* Header / Client Summary */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                        <User size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{caseData.client.name}</h2>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                                <Mail size={14} /> {caseData.client.email}
                            </div>
                            <div className="flex items-center gap-1">
                                <Briefcase size={14} /> {caseData.appType}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <StatusBadge status={caseData.status} />
                    <span className="text-xs text-gray-400">ID: #{caseData.id}</span>
                </div>
            </div>

            {/* Progress Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Data Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <DatabaseIcon className="text-blue-500" /> Data Collection
                        </h3>
                        <span className="text-xl font-bold text-blue-600">{dataProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                        <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${dataProgress}% ` }}></div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                        {dataProgress < 100 ? 'Client data forms are incomplete.' : 'All key data fields provided.'}
                    </p>
                    <Button variant="secondary" className="w-full" onClick={() => onNavigate('data')}>
                        Go to Workspace
                    </Button>
                </div>

                {/* Documents Card */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <FileText className="text-purple-500" size={20} /> Documents
                        </h3>
                        <span className="text-xl font-bold text-purple-600">{docProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                        <div className="bg-purple-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${docProgress}% ` }}></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                        <div className="bg-green-50 p-2 rounded text-green-700">
                            <strong>{verifiedSlots.length}</strong> Verified
                        </div>
                        <div className="bg-blue-50 p-2 rounded text-blue-700">
                            <strong>{uploadedSlots.length}</strong> Review
                        </div>
                        <div className="bg-red-50 p-2 rounded text-red-700">
                            <strong>{requiredSlots.length - verifiedSlots.length - uploadedSlots.length}</strong> Missing
                        </div>
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => onNavigate('documents')}>
                        Manage Documents
                    </Button>
                </div>
            </div>

            {/* Evaluation Panel - Powered by Rules Engine */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">Case Evaluation</h3>
                </div>
                <EvaluationPanel onNavigateToDocuments={() => onNavigate('documents')} />
            </div>
        </div>
    );
};

// Helper Icon
const DatabaseIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
);
