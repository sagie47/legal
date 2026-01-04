import React, { useState } from 'react';
import { Modal, Input, Button, Label } from '../../components/ui';
import { createEmployer } from '../../services/employers';
import { Building2 } from 'lucide-react';

interface EmployerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (employer: any) => void;
    orgId: string; // In real app, derived from auth context
}

export const EmployerModal = ({ isOpen, onClose, onSuccess, orgId }: EmployerModalProps) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        businessNumber: '',
        city: '',
        province: '',
        country: 'Canada',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const employer = await createEmployer(orgId, {
                companyName: formData.companyName,
                businessNumber: formData.businessNumber,
                address: {
                    city: formData.city,
                    province: formData.province,
                    country: formData.country,
                },
            });
            onSuccess(employer);
            onClose();
        } catch (error) {
            console.error('Failed to create employer:', error);
            // In a real app, show error toast
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Employer" maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <Label>Company Name</Label>
                    <Input
                        value={formData.companyName}
                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                        placeholder="e.g. Acme Construction Ltd."
                        required
                        autoFocus
                    />
                </div>

                <div>
                    <Label>CRA Business Number (BN9)</Label>
                    <Input
                        value={formData.businessNumber}
                        onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                        placeholder="123456789"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>City</Label>
                        <Input
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="Calgary"
                        />
                    </div>
                    <div>
                        <Label>Province</Label>
                        <Input
                            value={formData.province}
                            onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                            placeholder="AB"
                            maxLength={2}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="white" onClick={onClose} type="button">Cancel</Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading || !formData.companyName}
                        icon={<Building2 size={16} />}
                    >
                        {loading ? 'Creating...' : 'Create Employer'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
