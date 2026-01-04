import React, { useState, useEffect } from 'react';
import { Search, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Input, Label } from '../../components/ui';
import { Client } from './data';
import { getApplicants, createApplicant } from '../../services/applicants';
import { useAuth } from '../auth';

interface SmartClientSelectorProps {
    onSelect: (client: Client | null) => void;
    orgId: string;
}

export const SmartClientSelector = ({ onSelect, orgId }: SmartClientSelectorProps) => {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    // Data state
    const [applicants, setApplicants] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Form state
    const [newClientData, setNewClientData] = useState({ name: '', email: '' });
    const [emailError, setEmailError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch on mount or when orgId changes
    useEffect(() => {
        const fetchApplicants = async () => {
            if (!orgId) return;
            try {
                const data = await getApplicants(orgId);
                const mapped: Client[] = data.map((app: any) => ({
                    id: app.id,
                    name: `${app.identity?.givenNames} ${app.identity?.familyName}`.trim(),
                    email: 'N/A', // Placeholder
                    created: new Date(app.created_at).toLocaleDateString()
                }));
                setApplicants(mapped);
            } catch (error) {
                console.error("Failed to load applicants", error);
            }
        };
        fetchApplicants();
    }, [orgId]);

    const filteredClients = applicants.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (client: Client) => {
        setSelectedClient(client);
        setSearch(client.name);
        setIsOpen(false);
        onSelect(client);
    };

    const handleCreateNew = async () => {
        // Basic duplicate check (mock)
        const exists = applicants.some(c => c.name.toLowerCase() === newClientData.name.toLowerCase());
        // Email check is tricky without email in DB yet. 

        setIsSaving(true);
        try {
            // Split name best effort
            const parts = newClientData.name.trim().split(' ');
            const givenNames = parts.slice(0, -1).join(' ') || parts[0];
            const familyName = parts.slice(-1)[0] || '';

            const newApplicant = await createApplicant(orgId, {
                identity: {
                    givenNames: givenNames,
                    familyName: familyName,
                    dob: '2000-01-01', // Placeholder or add field
                },
                passport: {
                    number: 'UNKNOWN',
                    country: 'Unknown'
                }
            });

            const client: Client = {
                id: newApplicant.id,
                name: newClientData.name,
                email: newClientData.email,
                created: new Date().toLocaleDateString()
            };

            setApplicants([...applicants, client]);
            handleSelect(client);
            setIsCreating(false);
        } catch (error: any) {
            console.error("Failed to create applicant", error);
            setEmailError(error.message || 'Failed to create applicant');
        } finally {
            setIsSaving(false);
        }
    };

    if (selectedClient) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {selectedClient.name.charAt(0)}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-900">{selectedClient.name}</div>
                        <div className="text-xs text-gray-500">{selectedClient.email}</div>
                    </div>
                </div>
                <button
                    onClick={() => { setSelectedClient(null); setSearch(''); setIsCreating(false); onSelect(null); }}
                    className="text-xs text-red-600 hover:underline font-medium"
                >
                    Change
                </button>
            </div>
        );
    }

    if (isCreating) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold uppercase text-gray-500">New Client Profile</span>
                    <button onClick={() => setIsCreating(false)} className="text-xs text-gray-400 hover:text-black">Cancel</button>
                </div>
                <div>
                    <Label>Full Name</Label>
                    <Input
                        value={newClientData.name}
                        onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                        placeholder="e.g. Maria Gonzalez"
                        autoFocus
                    />
                </div>
                {/* 
                <div>
                    <Label>Email Address</Label>
                    <Input
                        value={newClientData.email}
                        onChange={(e) => {
                            setNewClientData({ ...newClientData, email: e.target.value });
                            setEmailError('');
                        }}
                        placeholder="maria@example.com"
                        className={emailError ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''}
                    />
                    {emailError && <p className="text-red-600 text-xs mt-1 font-medium flex items-center gap-1"><AlertCircle size={10} /> {emailError}</p>}
                </div>
                */}
                <div className="text-xs text-gray-400 italic">
                    Note: Using placeholders for DOB (2000-01-01) and Passport. Please update in profile later.
                </div>
                {emailError && <p className="text-red-600 text-xs font-medium flex items-center gap-1"><AlertCircle size={10} /> {emailError}</p>}

                <Button onClick={handleCreateNew} size="sm" className="w-full mt-2" disabled={!newClientData.name || isSaving}>
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : 'Confirm Client'}
                </Button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <Input
                    placeholder="Search by name..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                />
            </div>

            {isOpen && search && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                    {filteredClients.length > 0 ? (
                        <div className="py-1">
                            <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Matching Clients</div>
                            {filteredClients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => handleSelect(client)}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between group transition-colors"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                                        <div className="text-xs text-gray-500">{client.email}</div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 font-mono group-hover:text-gray-600">
                                        Added {client.created}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 text-center text-sm text-gray-500">No matching clients found.</div>
                    )}

                    <div className="border-t border-gray-100 p-1">
                        <button
                            onClick={() => { setIsCreating(true); setIsOpen(false); setNewClientData({ name: search, email: '' }); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent)] hover:bg-orange-50 font-medium rounded-sm transition-colors"
                        >
                            <UserPlus size={16} /> Create new client "{search}"
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
