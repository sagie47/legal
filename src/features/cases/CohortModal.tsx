import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Label, Select } from '../../components/ui';
import { createCohort } from '../../services/cohorts';
import { getEmployers } from '../../services/employers';
import { Layers, Briefcase } from 'lucide-react';

interface CohortModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (cohort: any) => void;
    orgId: string;
}

export const CohortModal = ({ isOpen, onClose, onSuccess, orgId }: CohortModalProps) => {
    const [loading, setLoading] = useState(false);
    const [employers, setEmployers] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        employerId: '',
        name: '', // e.g. "Spring 2025 Welders"
        jobTitle: '',
        nocCode: '',
        wageHourly: '',
        city: '',
        province: '',
        targetWorkers: '1'
    });

    useEffect(() => {
        if (isOpen) {
            // Fetch employers for dropdown
            getEmployers(orgId).then(data => {
                // Map Supabase snake_case to what UI expects if needed
                setEmployers(data.map((e: any) => ({
                    id: e.id,
                    companyName: e.company_name || e.companyName // fallback
                })));
            }).catch(console.error);
        }
    }, [isOpen, orgId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const cohort = await createCohort(orgId, formData.employerId, {
                name: formData.name,
                jobDetails: {
                    jobTitle: formData.jobTitle,
                    nocCode: formData.nocCode,
                    wageHourly: parseFloat(formData.wageHourly) || 0,
                    locationCity: formData.city,
                    locationProvince: formData.province,
                    targetWorkers: parseInt(formData.targetWorkers) || 1,
                    wageCurrency: 'CAD'
                }
            });
            onSuccess(cohort);
            onClose();
        } catch (error) {
            console.error('Failed to create cohort:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Create New Job Cohort">
            <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                    <Label>Employer</Label>
                    <div className="relative">
                        <select
                            className="w-full h-10 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent appearance-none"
                            value={formData.employerId}
                            onChange={(e) => setFormData({ ...formData, employerId: e.target.value })}
                            required
                        >
                            <option value="">Select an employer...</option>
                            {employers.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.companyName}</option>
                            ))}
                        </select>
                    </div>
                    {employers.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No employers found. Please add an employer first.</p>
                    )}
                </div>

                <div>
                    <Label>Cohort Name (Internal)</Label>
                    <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Spring 2025 Welders - Calgary"
                        required
                    />
                    <p className="text-[10px] text-gray-400 mt-1">A descriptive name for this group of applications.</p>
                </div>

                <div className="border-t border-gray-100 pt-4 mt-4">
                    <h4 className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                        <Briefcase size={16} /> Job Details
                    </h4>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <Label>Job Title</Label>
                            <Input
                                value={formData.jobTitle}
                                onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                                placeholder="e.g. Welder"
                                required
                            />
                        </div>
                        <div>
                            <Label>NOC Code</Label>
                            <Input
                                value={formData.nocCode}
                                onChange={(e) => setFormData({ ...formData, nocCode: e.target.value })}
                                placeholder="7237"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="col-span-1">
                            <Label>Wage ($/hr)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={formData.wageHourly}
                                onChange={(e) => setFormData({ ...formData, wageHourly: e.target.value })}
                                placeholder="28.50"
                                required
                            />
                        </div>
                        <div>
                            <Label>City</Label>
                            <Input
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                placeholder="Calgary"
                                required
                            />
                        </div>
                        <div>
                            <Label>Prov</Label>
                            <Input
                                value={formData.province}
                                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                                placeholder="AB"
                                maxLength={2}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <Label>Target # of Workers</Label>
                        <Input
                            type="number"
                            value={formData.targetWorkers}
                            onChange={(e) => setFormData({ ...formData, targetWorkers: e.target.value })}
                            min="1"
                            required
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                    <Button variant="white" onClick={onClose} type="button">Cancel</Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading || !formData.employerId || !formData.name}
                        icon={<Layers size={16} />}
                    >
                        {loading ? 'Creating...' : 'Create Cohort'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
