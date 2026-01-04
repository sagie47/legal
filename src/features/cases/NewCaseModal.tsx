import React, { useState, useEffect } from 'react';
import { Button, Label, Modal, Select } from '../../components/ui';
import { SmartClientSelector } from './SmartClientSelector';
import { Client, APPLICATION_STREAMS } from './data';
import { createApplication, createWorkPermitExtendCase, createStudyPermitCase } from '../../services/applications';
import type { CaseData } from './CaseList';

interface NewCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (caseData: CaseData) => void | Promise<void>;
    orgId: string;
}

export const NewCaseModal = ({ isOpen, onClose, onCreate, orgId }: NewCaseModalProps) => {
    const [client, setClient] = useState<Client | null>(null);
    const [appType, setAppType] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!client || !appType) return;
        if (!orgId) {
            setError('Missing organization id. Please sign in again.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            let application;

            // Use specialized creation for WP and Study Permit cases
            const isWPInsideCanada = appType === 'Work Permit Inside Canada';
            const isStudyOutsideCanada = appType === 'Study Permit Outside Canada';
            const isStudyInsideCanada = appType === 'Study Permit Inside Canada';

            if (isWPInsideCanada) {
                application = await createWorkPermitExtendCase({
                    applicantId: client.id,
                    orgId,
                    actionIntent: 'EXTEND',
                });
            } else if (isStudyOutsideCanada || isStudyInsideCanada) {
                application = await createStudyPermitCase({
                    applicantId: client.id,
                    orgId,
                    processingContext: isStudyOutsideCanada ? 'OUTSIDE_CANADA' : 'INSIDE_CANADA',
                    actionIntent: isStudyOutsideCanada ? 'APPLY' : 'EXTEND',
                });
            } else {
                application = await createApplication(client.id, null, appType, orgId);
            }

            const createdCase: CaseData = {
                id: application.id,
                client: {
                    id: client.id,
                    name: client.name,
                    email: client.email
                },
                appType: application.type,
                status: application.status,
                lastUpdated: new Date(application.updated_at || application.created_at || Date.now()).toLocaleDateString(),
                raw: application
            };

            await onCreate(createdCase);
            onClose();
        } catch (e: any) {
            setError(e?.message || 'Failed to create application');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setClient(null);
            setAppType('');
            setIsSubmitting(false);
            setError(null);
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Case">
            <div className="space-y-6">
                <div>
                    <Label>1. Select Client</Label>
                    <p className="text-sm text-gray-500 mb-2">Search for an existing client or create a new profile.</p>
                    <SmartClientSelector onSelect={setClient} orgId={orgId} />
                </div>

                <div className={`transition-opacity duration-300 ${client ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <Label>2. Application Stream</Label>
                    <Select
                        value={appType}
                        onChange={(e) => setAppType(e.target.value)}
                        disabled={!client}
                    >
                        <option value="">Select an application type...</option>
                        {APPLICATION_STREAMS.map(stream => (
                            <option key={stream} value={stream}>{stream}</option>
                        ))}
                    </Select>
                </div>

                {error && (
                    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                        {error}
                    </div>
                )}

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
                    <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button
                        disabled={!client || !appType}
                        onClick={handleSubmit}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Case'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
