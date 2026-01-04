import React, { useEffect, useState } from 'react';
import { UserPlus, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { Button, StatusBadge } from '../../components/ui';
import { getApplications } from '../../services/applications';

export interface CaseData {
    id: any;
    client: {
        id: any;
        name: string;
        email: string;
    };
    appType: string;
    status: string;
    lastUpdated: string;
    raw: any;
}

interface CaseListProps {
    onOpenCase: (caseData: CaseData) => void;
    onCreateNew: () => void;
    orgId: string;
    refreshKey?: number; // Increment to trigger re-fetch
    bypassOrgFilter?: boolean;
}

export const CaseList = ({ onOpenCase, onCreateNew, orgId, refreshKey, bypassOrgFilter = false }: CaseListProps) => {
    const [cases, setCases] = useState<CaseData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCases = async () => {
            if (!orgId && !bypassOrgFilter) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null); // Reset error on re-fetch

            // Create a timeout promise to prevent infinite loading
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Request timed out after 15 seconds')), 15000);
            });

            try {
                const resolvedOrgId = bypassOrgFilter ? (orgId || undefined) : orgId;
                // Race between the actual fetch and the timeout
                const data = await Promise.race([
                    getApplications(resolvedOrgId),
                    timeoutPromise
                ]);
                const mappedCases: CaseData[] = data.map((app: any) => {
                    // Robust handling for joined data which might be array or object
                    const applicantData = app.applicants;
                    // If join returns array, use first element; if object, use it directly.
                    const applicant = Array.isArray(applicantData) ? applicantData[0] : applicantData;

                    const givenNames = applicant?.identity?.givenNames || '';
                    const familyName = applicant?.identity?.familyName || '';
                    const fullName = `${givenNames} ${familyName}`.trim() || 'Unknown Client';

                    return {
                        id: app.id,
                        client: {
                            id: applicant?.id,
                            name: fullName,
                            email: 'N/A' // Email is not yet linked to applicants table
                        },
                        appType: app.type || 'General',
                        status: app.status || 'Draft',
                        lastUpdated: new Date(app.updated_at || app.created_at).toLocaleDateString(),
                        raw: app
                    };
                });
                setCases(mappedCases);
            } catch (err: any) {
                console.error("Failed to fetch applications:", err, { orgId });
                setError(err.message || "Unknown error occurred");
            } finally {
                setIsLoading(false);
            }
        };

        fetchCases();
    }, [orgId, refreshKey, bypassOrgFilter]); // Re-fetch when refreshKey changes

    if (isLoading) {
        return (
            <div className="p-8 w-full flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 w-full">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle size={20} />
                    <span>Failed to load cases: {error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Case Management</h1>
                    <p className="text-gray-500 mt-1">Manage active applications and client files.</p>
                </div>
                <Button onClick={onCreateNew} icon={<UserPlus size={16} />}>New Application</Button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                {cases.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserPlus className="text-gray-400" size={24} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No active cases</h3>
                        <p className="text-gray-500 mt-1 mb-6">Get started by creating a new application.</p>
                        <div className="flex justify-center">
                            <Button onClick={onCreateNew} variant="primary">Create Application</Button>
                        </div>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs uppercase text-gray-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Client</th>
                                <th className="px-6 py-3">Application Type</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Last Updated</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {cases.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50 transition-colors group cursor-pointer" onClick={() => onOpenCase(c)}>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900">{c.client.name}</div>
                                        <div className="text-xs text-gray-500">{c.client.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{c.appType}</td>
                                    <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                                    <td className="px-6 py-4 text-gray-500 font-mono text-xs">{c.lastUpdated}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-black p-1.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-all">
                                            <ExternalLink size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
