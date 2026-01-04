import React, { useState } from 'react';
import {
    User,
    ArrowLeft,
    Download,
    Upload,
    Briefcase,
    GraduationCap,
    Globe,
    CheckCircle2,
    AlertCircle,
    FileText,
    Loader2,
    Users,
    History,
    Plus,
    Shield,
    Trash2,
    MapPin
} from 'lucide-react';
import { Button, Input, Label, Select, StatusBadge } from '../../components/ui';
import { CaseData } from './CaseList';
import { useCase } from '../../context/CaseContext';

interface WorkspaceProps {
    caseData: CaseData;
    onBack: () => void;
    headless?: boolean;
}

export const Workspace = ({ caseData, onBack, headless = false }: WorkspaceProps) => {
    const [activeTab, setActiveTab] = useState('universal');
    const [genStatus, setGenStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');

    // Use Context for GLOBAL form state
    const {
        formData,
        updateFormData,
        addHistoryEntry,
        removeHistoryEntry,
        updateHistoryEntry,
        addResidence,
        removeResidence
    } = useCase();

    // Helper to maintain compatibility
    const setFormData = (updates: any) => updateFormData(updates);

    const [passportOcrData, setPassportOcrData] = useState<any>(null);

    const handlePassportDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setPassportOcrData({
            passportNum: 'A88291033',
            passportCountry: 'Mexico',
            passportIssueDate: '2020-01-15',
            passportExpiryDate: '2030-01-15',
            familyName: 'RODRIGUEZ',
            givenNames: 'JUAN'
        });
        updateFormData({
            passportNum: 'A88291033',
            passportCountry: 'Mexico',
            passportIssueDate: '2020-01-15',
            passportExpiryDate: '2030-01-15'
        });
    };

    const handleGenerate = () => {
        setGenStatus('processing');
        setTimeout(() => {
            if (!formData.passportNum) {
                setGenStatus('error');
            } else {
                setGenStatus('success');
            }
        }, 2000);
    };

    const isPassportExpiringSoon = () => {
        if (!formData.passportExpiryDate) return false;
        const expiry = new Date(formData.passportExpiryDate);
        const now = new Date();
        const monthsUntilExpiry = (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth());
        return monthsUntilExpiry < 6;
    };

    // Personal History & Residences are now in Context
    const { personalHistory, prevResidences } = formData;

    const tabs = [
        { id: 'universal', label: 'Universal Data', icon: User },
        { id: 'passport', label: 'Passport & IDs', icon: Globe },
        { id: 'education', label: 'Education', icon: GraduationCap },
        { id: 'employment', label: 'Employment', icon: Briefcase },
        { id: 'history', label: 'Personal History', icon: History },
        { id: 'family', label: 'Family', icon: Users },
        { id: 'background', label: 'Background & Security', icon: Shield },
        { id: 'immigration', label: 'Immigration', icon: MapPin }
    ];

    return (
        <div className="h-full flex flex-col bg-white">
            {!headless && (
                <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6 bg-white shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="h-6 w-px bg-gray-200"></div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">{caseData.client.name}</h2>
                            <p className="text-xs text-gray-500">{caseData.appType}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-400">ID: #LM-{Date.now().toString().slice(-6)}</span>
                        <StatusBadge status="Draft" />
                    </div>
                </header>
            )}

            <div className="flex flex-1 overflow-hidden">
                <div className="w-2/3 border-r border-gray-200 flex flex-col bg-gray-50/50">
                    <div className="px-6 pt-6 pb-2 border-b border-gray-200/50 bg-white overflow-x-auto">
                        <div className="flex gap-4">
                            {tabs.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${isActive ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                                    >
                                        <Icon size={16} className={isActive ? 'text-black' : 'text-gray-400'} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        {/* UNIVERSAL DATA TAB */}
                        {activeTab === 'universal' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                {/* Section A: Identity */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">A</span>
                                        Identity
                                    </h3>
                                    <div className="mb-4">
                                        <Label>Full Legal Name (Preview)</Label>
                                        <div className="p-2 bg-gray-50 border border-gray-200 rounded text-sm font-mono text-gray-600">
                                            {formData.familyName}, {formData.givenNames}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Family Name</Label>
                                            <Input value={formData.familyName} onChange={e => setFormData({ ...formData, familyName: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Given Name(s)</Label>
                                            <Input value={formData.givenNames} onChange={e => setFormData({ ...formData, givenNames: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Date of Birth</Label>
                                            <Input type="date" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Sex</Label>
                                            <Select value={formData.sex} onChange={e => setFormData({ ...formData, sex: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="M">Male</option>
                                                <option value="F">Female</option>
                                                <option value="X">Another Gender</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Marital Status</Label>
                                            <Select value={formData.maritalStatus} onChange={e => setFormData({ ...formData, maritalStatus: e.target.value })}>
                                                <option value="">Select Status...</option>
                                                <option value="single">Single</option>
                                                <option value="married">Married</option>
                                                <option value="common-law">Common-Law</option>
                                                <option value="divorced">Divorced</option>
                                                <option value="widowed">Widowed</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>UCI / Client ID (if known)</Label>
                                            <Input value={formData.uci} onChange={e => setFormData({ ...formData, uci: e.target.value })} placeholder="e.g. 1234-5678" />
                                        </div>
                                        <div className="col-span-2 pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.hasOtherNames}
                                                    onChange={e => setFormData({ ...formData, hasOtherNames: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Have you ever used any other name(s)?</span>
                                            </label>
                                            {formData.hasOtherNames && (
                                                <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                    <Label>Other Names / Aliases</Label>
                                                    <Input
                                                        value={formData.otherNames}
                                                        onChange={e => setFormData({ ...formData, otherNames: e.target.value })}
                                                        placeholder="e.g. SMITH, Jane Marie; DOE, Jane (comma separated)"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">Enter as: Family Name, Given Names for each alias</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section B: Birth & Citizenship */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">B</span>
                                        Birth & Citizenship
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Country of Birth</Label>
                                            <Select value={formData.countryOfBirth} onChange={e => setFormData({ ...formData, countryOfBirth: e.target.value })}>
                                                <option value="">Select Country...</option>
                                                <option value="Canada">Canada</option>
                                                <option value="USA">USA</option>
                                                <option value="India">India</option>
                                                <option value="China">China</option>
                                                <option value="Philippines">Philippines</option>
                                                <option value="Mexico">Mexico</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>City/Town of Birth</Label>
                                            <Input value={formData.cityOfBirth} onChange={e => setFormData({ ...formData, cityOfBirth: e.target.value })} placeholder="e.g. Toronto" />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Citizenship(s)</Label>
                                            <Input value={formData.citizenships} onChange={e => setFormData({ ...formData, citizenships: e.target.value })} placeholder="e.g. Canadian, American (comma separated)" />
                                        </div>
                                    </div>
                                </div>

                                {/* Section C: Contact & Residence */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">C</span>
                                        Contact & Residence
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Label>Email Address</Label>
                                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Phone Number</Label>
                                            <Input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 (555) 000-0000" />
                                        </div>
                                        <div>
                                            <Label>Current Country of Residence</Label>
                                            <Select value={formData.countryOfResidence} onChange={e => setFormData({ ...formData, countryOfResidence: e.target.value })}>
                                                <option value="">Select Country...</option>
                                                <option value="Canada">Canada</option>
                                                <option value="USA">USA</option>
                                                <option value="India">India</option>
                                                <option value="China">China</option>
                                                <option value="Philippines">Philippines</option>
                                                <option value="Mexico">Mexico</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Status in Country of Residence</Label>
                                            <Select value={formData.residenceStatus} onChange={e => setFormData({ ...formData, residenceStatus: e.target.value })}>
                                                <option value="">Select Status...</option>
                                                <option value="citizen">Citizen</option>
                                                <option value="pr">Permanent Resident</option>
                                                <option value="worker">Worker</option>
                                                <option value="student">Student</option>
                                                <option value="visitor">Visitor</option>
                                                <option value="other">Other</option>
                                            </Select>
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Current Residential Address</Label>
                                            <Input value={formData.residentialAddress} onChange={e => setFormData({ ...formData, residentialAddress: e.target.value })} placeholder="Full address..." />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.mailingSameAsResidential}
                                                    onChange={e => setFormData({ ...formData, mailingSameAsResidential: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Mailing address is same as residential</span>
                                            </label>
                                            {!formData.mailingSameAsResidential && (
                                                <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                                                    <Label>Mailing Address</Label>
                                                    <Input value={formData.mailingAddress} onChange={e => setFormData({ ...formData, mailingAddress: e.target.value })} placeholder="Mailing address..." />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section D: National ID Document */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">D</span>
                                        National ID Document
                                    </h3>
                                    <div className="space-y-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.hasNationalId}
                                                onChange={e => setFormData({ ...formData, hasNationalId: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                            />
                                            <span className="text-sm text-gray-700">I have a National ID document</span>
                                        </label>
                                        {formData.hasNationalId && (
                                            <div className="grid grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-1">
                                                <div className="col-span-2">
                                                    <Label>National ID Number</Label>
                                                    <Input value={formData.nationalIdNumber} onChange={e => setFormData({ ...formData, nationalIdNumber: e.target.value })} placeholder="e.g. ABC123456" />
                                                </div>
                                                <div>
                                                    <Label>Country of Issue</Label>
                                                    <Select value={formData.nationalIdCountry} onChange={e => setFormData({ ...formData, nationalIdCountry: e.target.value })}>
                                                        <option value="">Select Country...</option>
                                                        <option value="India">India</option>
                                                        <option value="China">China</option>
                                                        <option value="Philippines">Philippines</option>
                                                        <option value="Mexico">Mexico</option>
                                                        <option value="Other">Other</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Issue Date (Optional)</Label>
                                                    <Input type="date" value={formData.nationalIdIssueDate} onChange={e => setFormData({ ...formData, nationalIdIssueDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Expiry Date</Label>
                                                    <Input type="date" value={formData.nationalIdExpiry} onChange={e => setFormData({ ...formData, nationalIdExpiry: e.target.value })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Section E: Languages */}
                                <div className="pt-6 border-t border-gray-100">
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">E</span>
                                        Languages
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Label>Native Language / Mother Tongue</Label>
                                            <Select value={formData.nativeLanguage} onChange={e => setFormData({ ...formData, nativeLanguage: e.target.value })}>
                                                <option value="">Select Language...</option>
                                                <option value="English">English</option>
                                                <option value="French">French</option>
                                                <option value="Mandarin">Mandarin Chinese</option>
                                                <option value="Spanish">Spanish</option>
                                                <option value="Hindi">Hindi</option>
                                                <option value="Punjabi">Punjabi</option>
                                                <option value="Tagalog">Tagalog</option>
                                                <option value="Arabic">Arabic</option>
                                                <option value="Portuguese">Portuguese</option>
                                                <option value="Other">Other</option>
                                            </Select>
                                        </div>
                                        <div className="col-span-2 space-y-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.canCommunicateEnglish}
                                                    onChange={e => setFormData({ ...formData, canCommunicateEnglish: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Able to communicate in English</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.canCommunicateFrench}
                                                    onChange={e => setFormData({ ...formData, canCommunicateFrench: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Able to communicate in French</span>
                                            </label>
                                        </div>
                                        <div className="col-span-2 pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.languageTestTaken}
                                                    onChange={e => setFormData({ ...formData, languageTestTaken: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Have you taken a language proficiency test?</span>
                                            </label>
                                            {formData.languageTestTaken && (
                                                <div className="grid grid-cols-2 gap-4 mt-3 animate-in fade-in slide-in-from-top-1">
                                                    <div>
                                                        <Label>Test Type</Label>
                                                        <Select value={formData.languageTestType} onChange={e => setFormData({ ...formData, languageTestType: e.target.value })}>
                                                            <option value="">Select Test...</option>
                                                            <option value="IELTS">IELTS</option>
                                                            <option value="CELPIP">CELPIP</option>
                                                            <option value="TEF">TEF Canada</option>
                                                            <option value="TCF">TCF Canada</option>
                                                            <option value="PTE">PTE Academic</option>
                                                            <option value="Other">Other</option>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Overall Score (Optional)</Label>
                                                        <Input
                                                            value={formData.languageTestScore}
                                                            onChange={e => setFormData({ ...formData, languageTestScore: e.target.value })}
                                                            placeholder="e.g. 7.5 or CLB 9"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PASSPORT TAB */}
                        {activeTab === 'passport' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                <div
                                    className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer group"
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handlePassportDrop}
                                >
                                    <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-3 text-gray-400 group-hover:text-[var(--accent)] group-hover:scale-110 transition-all">
                                        <Upload size={24} />
                                    </div>
                                    <div className="text-sm font-medium text-gray-900">Drop passport image/PDF to autopopulate</div>
                                    <div className="text-xs text-gray-500 mt-1">Supports JPG, PNG, PDF</div>
                                </div>

                                {passportOcrData && (
                                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-md flex items-start gap-3">
                                        <div className="text-blue-600 mt-0.5"><CheckCircle2 size={16} /></div>
                                        <div>
                                            <p className="text-sm text-blue-800 font-medium">Data extracted from passport</p>
                                            <p className="text-xs text-blue-600 mt-0.5">Please review the populated fields below.</p>
                                        </div>
                                    </div>
                                )}

                                {isPassportExpiringSoon() && (
                                    <div className="bg-amber-50 border border-amber-100 p-3 rounded-md flex items-start gap-3">
                                        <div className="text-amber-600 mt-0.5"><AlertCircle size={16} /></div>
                                        <div>
                                            <p className="text-sm text-amber-800 font-medium">Passport expiring soon</p>
                                            <p className="text-xs text-amber-600 mt-0.5">Expiry date is within 6 months. This may affect permit duration.</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h3 className="font-bold text-lg mb-4">Primary Passport</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Label>Passport Number</Label>
                                            <div className="relative">
                                                <Input
                                                    value={formData.passportNum}
                                                    onChange={e => setFormData({ ...formData, passportNum: e.target.value })}
                                                    placeholder="A12345678"
                                                    className={passportOcrData ? "bg-blue-50/30" : ""}
                                                />
                                                {passportOcrData && <span className="absolute right-3 top-2.5 text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">OCR</span>}
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Country of Issue</Label>
                                            <Select value={formData.passportCountry} onChange={e => setFormData({ ...formData, passportCountry: e.target.value })}>
                                                <option value="">Select Country...</option>
                                                <option value="Canada">Canada</option>
                                                <option value="USA">USA</option>
                                                <option value="India">India</option>
                                                <option value="Mexico">Mexico</option>
                                                <option value="Other">Other</option>
                                            </Select>
                                        </div>
                                        <div></div>
                                        <div>
                                            <Label>Issue Date</Label>
                                            <Input type="date" value={formData.passportIssueDate} onChange={e => setFormData({ ...formData, passportIssueDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <Label>Expiry Date</Label>
                                            <Input type="date" value={formData.passportExpiryDate} onChange={e => setFormData({ ...formData, passportExpiryDate: e.target.value })} />
                                        </div>
                                        <div className="col-span-2 pt-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isUSPassport}
                                                    onChange={e => setFormData({ ...formData, isUSPassport: e.target.checked })}
                                                    className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                />
                                                <span className="text-sm text-gray-700">Is this a valid US Passport?</span>
                                            </label>
                                            {formData.isUSPassport && (
                                                <p className="text-xs text-blue-600 mt-1 ml-6">US Citizens require an eTA instead of a visa.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EDUCATION TAB */}
                        {activeTab === 'education' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg">Education History</h3>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">MVP: Single Entry</span>
                                    </div>

                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <Label>Highest Level of Education</Label>
                                                <Select value={formData.eduLevel} onChange={e => setFormData({ ...formData, eduLevel: e.target.value })}>
                                                    <option value="">Select Level...</option>
                                                    <option value="secondary">Secondary (High School)</option>
                                                    <option value="bachelors">Bachelor's Degree</option>
                                                    <option value="masters">Master's Degree</option>
                                                    <option value="phd">PhD</option>
                                                    <option value="diploma">College Diploma/Certificate</option>
                                                </Select>
                                            </div>
                                            <div className="col-span-2">
                                                <Label>School/Institution Name</Label>
                                                <Input value={formData.eduSchool} onChange={e => setFormData({ ...formData, eduSchool: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Country</Label>
                                                <Select value={formData.eduCountry} onChange={e => setFormData({ ...formData, eduCountry: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    <option value="Canada">Canada</option>
                                                    <option value="USA">USA</option>
                                                    <option value="Other">Other</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Field of Study</Label>
                                                <Input value={formData.eduField} onChange={e => setFormData({ ...formData, eduField: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>From Date</Label>
                                                <Input type="date" value={formData.eduFrom} onChange={e => setFormData({ ...formData, eduFrom: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>To Date</Label>
                                                <Input type="date" value={formData.eduTo} onChange={e => setFormData({ ...formData, eduTo: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* EMPLOYMENT TAB */}
                        {activeTab === 'employment' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg">Current Status</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <div>
                                            <Label>Current Activity</Label>
                                            <Select value={formData.currentActivity} onChange={e => setFormData({ ...formData, currentActivity: e.target.value })}>
                                                <option value="">Select...</option>
                                                <option value="employed">Employed</option>
                                                <option value="unemployed">Unemployed</option>
                                                <option value="studying">Studying</option>
                                                <option value="other">Other</option>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>Employer Contact (Phone/Email)</Label>
                                            <Input value={formData.employerContact} onChange={e => setFormData({ ...formData, employerContact: e.target.value })} placeholder="Optional" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg">Employment History</h3>
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">MVP: Single Entry</span>
                                    </div>

                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <Label>Job Title</Label>
                                                <Input value={formData.jobTitle} onChange={e => setFormData({ ...formData, jobTitle: e.target.value })} />
                                            </div>
                                            <div className="col-span-2">
                                                <Label>Employer Name</Label>
                                                <Input value={formData.employerName} onChange={e => setFormData({ ...formData, employerName: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Country</Label>
                                                <Select value={formData.jobCountry} onChange={e => setFormData({ ...formData, jobCountry: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    <option value="Canada">Canada</option>
                                                    <option value="USA">USA</option>
                                                    <option value="Other">Other</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>City</Label>
                                                <Input value={formData.jobCity} onChange={e => setFormData({ ...formData, jobCity: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>NOC Code (Optional)</Label>
                                                <Input value={formData.jobNoc} onChange={e => setFormData({ ...formData, jobNoc: e.target.value })} placeholder="e.g. 2171" />
                                            </div>
                                            <div></div>
                                            <div>
                                                <Label>From Date</Label>
                                                <Input type="date" value={formData.jobFrom} onChange={e => setFormData({ ...formData, jobFrom: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>To Date</Label>
                                                <Input type="date" value={formData.jobTo} onChange={e => setFormData({ ...formData, jobTo: e.target.value })} />
                                            </div>
                                            <div className="col-span-2">
                                                <Label>Main Duties</Label>
                                                <textarea
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[100px]"
                                                    value={formData.jobDuties}
                                                    onChange={e => setFormData({ ...formData, jobDuties: e.target.value })}
                                                    placeholder="Describe main duties..."
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PERSONAL HISTORY TAB (10 years) */}
                        {activeTab === 'history' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        <strong>Required:</strong> List all activities for the past 10 years (or since age 18 if shorter). Include employment, education, unemployment, and other activities. Leave no gaps.
                                    </p>
                                </div>

                                {personalHistory.map((entry, index) => (
                                    <div key={entry.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50/30 relative">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-xs font-bold text-gray-500 uppercase">Activity {index + 1}</span>
                                            {personalHistory.length > 1 && (
                                                <button
                                                    onClick={() => removeHistoryEntry(entry.id)}
                                                    className="text-red-500 hover:text-red-700 p-1"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <Label>Activity Type</Label>
                                                <Select
                                                    value={entry.type}
                                                    onChange={e => updateHistoryEntry(entry.id, 'type', e.target.value)}
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="employed">Employed</option>
                                                    <option value="self_employed">Self-Employed</option>
                                                    <option value="education">Education/Studying</option>
                                                    <option value="unemployed">Unemployed</option>
                                                    <option value="homemaker">Homemaker</option>
                                                    <option value="retired">Retired</option>
                                                    <option value="other">Other</option>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>From Date</Label>
                                                <Input
                                                    type="month"
                                                    value={entry.fromDate}
                                                    onChange={e => updateHistoryEntry(entry.id, 'fromDate', e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <Label>To Date</Label>
                                                <Input
                                                    type="month"
                                                    value={entry.toDate}
                                                    onChange={e => updateHistoryEntry(entry.id, 'toDate', e.target.value)}
                                                    placeholder="Present"
                                                />
                                            </div>
                                            {(entry.type === 'employed' || entry.type === 'self_employed' || entry.type === 'education') && (
                                                <>
                                                    <div className="col-span-2">
                                                        <Label>{entry.type === 'education' ? 'School/Institution' : 'Employer/Organization'}</Label>
                                                        <Input
                                                            value={entry.organization}
                                                            onChange={e => updateHistoryEntry(entry.id, 'organization', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>City</Label>
                                                        <Input
                                                            value={entry.city}
                                                            onChange={e => updateHistoryEntry(entry.id, 'city', e.target.value)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <Label>Country</Label>
                                                        <Select
                                                            value={entry.country}
                                                            onChange={e => updateHistoryEntry(entry.id, 'country', e.target.value)}
                                                        >
                                                            <option value="">Select...</option>
                                                            <option value="Canada">Canada</option>
                                                            <option value="USA">USA</option>
                                                            <option value="India">India</option>
                                                            <option value="Mexico">Mexico</option>
                                                            <option value="Philippines">Philippines</option>
                                                            <option value="Other">Other</option>
                                                        </Select>
                                                    </div>
                                                </>
                                            )}
                                            <div className="col-span-2">
                                                <Label>Description / Job Title (Optional)</Label>
                                                <Input
                                                    value={entry.description}
                                                    onChange={e => updateHistoryEntry(entry.id, 'description', e.target.value)}
                                                    placeholder="Brief description of activity"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    onClick={addHistoryEntry}
                                    className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black transition-colors"
                                >
                                    <Plus size={16} /> Add Another Activity
                                </button>
                            </div>
                        )}

                        {/* FAMILY TAB */}
                        {activeTab === 'family' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                {/* Spouse/Partner Section */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</span>
                                        Spouse / Common-Law Partner
                                    </h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="col-span-2">
                                                <Label>Relationship Type</Label>
                                                <Select value={formData.spouseRelationType} onChange={e => setFormData({ ...formData, spouseRelationType: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    <option value="none">None / Not Applicable</option>
                                                    <option value="spouse">Spouse (Married)</option>
                                                    <option value="common-law">Common-Law Partner</option>
                                                </Select>
                                            </div>
                                            {formData.spouseRelationType && formData.spouseRelationType !== 'none' && (
                                                <>
                                                    <div>
                                                        <Label>Family Name</Label>
                                                        <Input value={formData.spouseFamilyName} onChange={e => setFormData({ ...formData, spouseFamilyName: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <Label>Given Name(s)</Label>
                                                        <Input value={formData.spouseGivenNames} onChange={e => setFormData({ ...formData, spouseGivenNames: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <Label>Date of Birth</Label>
                                                        <Input type="date" value={formData.spouseDob} onChange={e => setFormData({ ...formData, spouseDob: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <Label>Country of Birth</Label>
                                                        <Select value={formData.spouseCountryOfBirth} onChange={e => setFormData({ ...formData, spouseCountryOfBirth: e.target.value })}>
                                                            <option value="">Select...</option>
                                                            <option value="Canada">Canada</option>
                                                            <option value="USA">USA</option>
                                                            <option value="India">India</option>
                                                            <option value="Mexico">Mexico</option>
                                                            <option value="Other">Other</option>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <Label>Citizenship(s)</Label>
                                                        <Input value={formData.spouseCitizenships} onChange={e => setFormData({ ...formData, spouseCitizenships: e.target.value })} placeholder="e.g. Mexican" />
                                                    </div>
                                                    <div>
                                                        <Label>Country of Residence</Label>
                                                        <Select value={formData.spouseCountryOfResidence} onChange={e => setFormData({ ...formData, spouseCountryOfResidence: e.target.value })}>
                                                            <option value="">Select...</option>
                                                            <option value="Canada">Canada</option>
                                                            <option value="USA">USA</option>
                                                            <option value="India">India</option>
                                                            <option value="Mexico">Mexico</option>
                                                            <option value="Other">Other</option>
                                                        </Select>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.spouseAccompanying}
                                                                onChange={e => setFormData({ ...formData, spouseAccompanying: e.target.checked })}
                                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                            />
                                                            <span className="text-sm text-gray-700">Will accompany the applicant to Canada</span>
                                                        </label>
                                                    </div>
                                                    <div className="col-span-2 pt-3 border-t border-gray-100 mt-2">
                                                        <Label>Date of Marriage / Relationship Start (Optional)</Label>
                                                        <Input type="date" value={formData.dateOfRelationshipStart} onChange={e => setFormData({ ...formData, dateOfRelationshipStart: e.target.value })} />
                                                    </div>
                                                    <div>
                                                        <Label>Place of Marriage - City (Optional)</Label>
                                                        <Input value={formData.placeOfMarriageCity} onChange={e => setFormData({ ...formData, placeOfMarriageCity: e.target.value })} placeholder="e.g. Toronto" />
                                                    </div>
                                                    <div>
                                                        <Label>Place of Marriage - Country (Optional)</Label>
                                                        <Select value={formData.placeOfMarriageCountry} onChange={e => setFormData({ ...formData, placeOfMarriageCountry: e.target.value })}>
                                                            <option value="">Select Country...</option>
                                                            <option value="Canada">Canada</option>
                                                            <option value="USA">USA</option>
                                                            <option value="India">India</option>
                                                            <option value="China">China</option>
                                                            <option value="Philippines">Philippines</option>
                                                            <option value="Mexico">Mexico</option>
                                                            <option value="Other">Other</option>
                                                        </Select>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Children Section */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">2</span>
                                        Children
                                    </h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                                            <input
                                                type="checkbox"
                                                checked={formData.hasChildren}
                                                onChange={e => setFormData({ ...formData, hasChildren: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                            />
                                            <span className="text-sm text-gray-700">I have dependent children</span>
                                        </label>
                                        {formData.hasChildren && (
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 animate-in fade-in slide-in-from-top-1">
                                                <div className="col-span-2 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-500 uppercase">Child 1</span>
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">MVP: Single Entry</span>
                                                </div>
                                                <div>
                                                    <Label>Family Name</Label>
                                                    <Input value={formData.childFamilyName} onChange={e => setFormData({ ...formData, childFamilyName: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Given Name(s)</Label>
                                                    <Input value={formData.childGivenNames} onChange={e => setFormData({ ...formData, childGivenNames: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Date of Birth</Label>
                                                    <Input type="date" value={formData.childDob} onChange={e => setFormData({ ...formData, childDob: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Country of Birth</Label>
                                                    <Select value={formData.childCountryOfBirth} onChange={e => setFormData({ ...formData, childCountryOfBirth: e.target.value })}>
                                                        <option value="">Select...</option>
                                                        <option value="Canada">Canada</option>
                                                        <option value="USA">USA</option>
                                                        <option value="India">India</option>
                                                        <option value="Mexico">Mexico</option>
                                                        <option value="Other">Other</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Citizenship(s)</Label>
                                                    <Input value={formData.childCitizenships} onChange={e => setFormData({ ...formData, childCitizenships: e.target.value })} placeholder="e.g. Mexican" />
                                                </div>
                                                <div className="flex items-end">
                                                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.childAccompanying}
                                                            onChange={e => setFormData({ ...formData, childAccompanying: e.target.checked })}
                                                            className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                                        />
                                                        <span className="text-sm text-gray-700">Will accompany</span>
                                                    </label>
                                                </div>
                                                <div className="col-span-2 pt-2">
                                                    <button disabled className="text-sm text-gray-400 flex items-center gap-1 cursor-not-allowed">
                                                        <Plus size={14} /> Add another child (coming soon)
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Parents Section */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">3</span>
                                        Parents (IMM 5707)
                                    </h3>

                                    {/* Mother */}
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30 mb-4">
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-3 block">Mother</span>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Family Name</Label>
                                                <Input value={formData.motherFamilyName} onChange={e => setFormData({ ...formData, motherFamilyName: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Given Name(s)</Label>
                                                <Input value={formData.motherGivenNames} onChange={e => setFormData({ ...formData, motherGivenNames: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Date of Birth</Label>
                                                <Input type="date" value={formData.motherDob} onChange={e => setFormData({ ...formData, motherDob: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Country of Birth</Label>
                                                <Select value={formData.motherCountryOfBirth} onChange={e => setFormData({ ...formData, motherCountryOfBirth: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    <option value="Canada">Canada</option>
                                                    <option value="USA">USA</option>
                                                    <option value="India">India</option>
                                                    <option value="China">China</option>
                                                    <option value="Philippines">Philippines</option>
                                                    <option value="Mexico">Mexico</option>
                                                    <option value="Other">Other</option>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Father */}
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <span className="text-xs font-bold text-gray-500 uppercase mb-3 block">Father</span>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <Label>Family Name</Label>
                                                <Input value={formData.fatherFamilyName} onChange={e => setFormData({ ...formData, fatherFamilyName: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Given Name(s)</Label>
                                                <Input value={formData.fatherGivenNames} onChange={e => setFormData({ ...formData, fatherGivenNames: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Date of Birth</Label>
                                                <Input type="date" value={formData.fatherDob} onChange={e => setFormData({ ...formData, fatherDob: e.target.value })} />
                                            </div>
                                            <div>
                                                <Label>Country of Birth</Label>
                                                <Select value={formData.fatherCountryOfBirth} onChange={e => setFormData({ ...formData, fatherCountryOfBirth: e.target.value })}>
                                                    <option value="">Select...</option>
                                                    <option value="Canada">Canada</option>
                                                    <option value="USA">USA</option>
                                                    <option value="India">India</option>
                                                    <option value="China">China</option>
                                                    <option value="Philippines">Philippines</option>
                                                    <option value="Mexico">Mexico</option>
                                                    <option value="Other">Other</option>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* BACKGROUND & SECURITY TAB */}
                        {activeTab === 'background' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg">
                                    <p className="text-sm text-amber-800">
                                        <strong>Note:</strong> These questions are application-specific and required for most temporary resident applications (study permit, work permit, visitor visa).
                                    </p>
                                </div>

                                {/* Q1: TB Contact */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qTbContact}
                                            onChange={e => setFormData({ ...formData, qTbContact: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Within the past two years, have you or a family member had tuberculosis (TB) or been in close contact with a person with TB?</span>
                                    </label>
                                    {formData.qTbContact && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qTbContactExplanation}
                                                onChange={e => setFormData({ ...formData, qTbContactExplanation: e.target.value })}
                                                placeholder="Provide details..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q2: Medical Needs */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qMedicalNeeds}
                                            onChange={e => setFormData({ ...formData, qMedicalNeeds: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Do you have any physical or mental disorder that would require social and/or health services, other than medication, during your stay in Canada?</span>
                                    </label>
                                    {formData.qMedicalNeeds && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qMedicalNeedsExplanation}
                                                onChange={e => setFormData({ ...formData, qMedicalNeedsExplanation: e.target.value })}
                                                placeholder="Provide details..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q3: Status Violations */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qStatusViolations}
                                            onChange={e => setFormData({ ...formData, qStatusViolations: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever remained beyond the validity of your status, worked without authorization, or studied without authorization in Canada?</span>
                                    </label>
                                    {formData.qStatusViolations && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qStatusViolationsExplanation}
                                                onChange={e => setFormData({ ...formData, qStatusViolationsExplanation: e.target.value })}
                                                placeholder="Provide details..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q4: Visa Refusal */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qVisaRefusal}
                                            onChange={e => setFormData({ ...formData, qVisaRefusal: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever been refused a visa or permit, denied entry or ordered to leave Canada or any other country?</span>
                                    </label>
                                    {formData.qVisaRefusal && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qVisaRefusalExplanation}
                                                onChange={e => setFormData({ ...formData, qVisaRefusalExplanation: e.target.value })}
                                                placeholder="Provide details including country and date..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q5: Previous Canada Application */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qPreviousApplication}
                                            onChange={e => setFormData({ ...formData, qPreviousApplication: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you previously applied to enter or remain in Canada?</span>
                                    </label>
                                    {formData.qPreviousApplication && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Provide details</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qPreviousApplicationDetails}
                                                onChange={e => setFormData({ ...formData, qPreviousApplicationDetails: e.target.value })}
                                                placeholder="Application type, date, and outcome..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q6: Criminal Offence */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qCriminalOffence}
                                            onChange={e => setFormData({ ...formData, qCriminalOffence: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever committed, been arrested for, charged with or convicted of any criminal offence in any country?</span>
                                    </label>
                                    {formData.qCriminalOffence && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qCriminalOffenceExplanation}
                                                onChange={e => setFormData({ ...formData, qCriminalOffenceExplanation: e.target.value })}
                                                placeholder="Provide details including offence, date, and outcome..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q7: Military Service */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qMilitaryService}
                                            onChange={e => setFormData({ ...formData, qMilitaryService: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever served in any military, militia, civil defence unit, security organization, police force, or government agency (including as a volunteer)?</span>
                                    </label>
                                    {formData.qMilitaryService && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Provide details</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qMilitaryServiceDetails}
                                                onChange={e => setFormData({ ...formData, qMilitaryServiceDetails: e.target.value })}
                                                placeholder="Organization, dates of service, rank, duties..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q8: Violent Organizations */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qViolentOrgs}
                                            onChange={e => setFormData({ ...formData, qViolentOrgs: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Are you or have you ever been a member or associated with any political party, group, or organization that has used or advocated violence?</span>
                                    </label>
                                    {formData.qViolentOrgs && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qViolentOrgsExplanation}
                                                onChange={e => setFormData({ ...formData, qViolentOrgsExplanation: e.target.value })}
                                                placeholder="Provide details..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q9: Human Rights Violations */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qHrViolations}
                                            onChange={e => setFormData({ ...formData, qHrViolations: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever witnessed or participated in the ill treatment of prisoners or civilians, looting, or desecration of religious buildings?</span>
                                    </label>
                                    {formData.qHrViolations && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Please explain</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qHrViolationsExplanation}
                                                onChange={e => setFormData({ ...formData, qHrViolationsExplanation: e.target.value })}
                                                placeholder="Provide details..."
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Q10: Government Positions */}
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.qGovPositions}
                                            onChange={e => setFormData({ ...formData, qGovPositions: e.target.checked })}
                                            className="w-4 h-4 mt-0.5 rounded border-gray-300 text-black focus:ring-black"
                                        />
                                        <span className="text-sm text-gray-700">Have you ever held, or are you applying to hold, any government positions?</span>
                                    </label>
                                    {formData.qGovPositions && (
                                        <div className="mt-3 ml-7 animate-in fade-in slide-in-from-top-1">
                                            <Label>Provide details</Label>
                                            <textarea
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-sm text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black min-h-[80px]"
                                                value={formData.qGovPositionsDetails}
                                                onChange={e => setFormData({ ...formData, qGovPositionsDetails: e.target.value })}
                                                placeholder="Position, organization, dates..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* IMMIGRATION TAB */}
                        {activeTab === 'immigration' && (
                            <div className="max-w-2xl bg-white p-8 rounded-xl border border-gray-200 shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                {/* Status in Canada */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">1</span>
                                        Status in Canada
                                    </h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30">
                                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                                            <input
                                                type="checkbox"
                                                checked={formData.currentlyInCanada}
                                                onChange={e => setFormData({ ...formData, currentlyInCanada: e.target.checked })}
                                                className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black"
                                            />
                                            <span className="text-sm text-gray-700">I am currently in Canada</span>
                                        </label>
                                        {formData.currentlyInCanada && (
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 animate-in fade-in slide-in-from-top-1">
                                                <div>
                                                    <Label>Date of Original Entry</Label>
                                                    <Input type="date" value={formData.dateOfEntry} onChange={e => setFormData({ ...formData, dateOfEntry: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Original Entry City</Label>
                                                    <Input value={formData.originalEntryCity} onChange={e => setFormData({ ...formData, originalEntryCity: e.target.value })} placeholder="e.g. Toronto" />
                                                </div>
                                                <div>
                                                    <Label>Original Entry Province</Label>
                                                    <Select value={formData.originalEntryProvince} onChange={e => setFormData({ ...formData, originalEntryProvince: e.target.value })}>
                                                        <option value="">Select Province...</option>
                                                        <option value="AB">Alberta</option>
                                                        <option value="BC">British Columbia</option>
                                                        <option value="MB">Manitoba</option>
                                                        <option value="NB">New Brunswick</option>
                                                        <option value="NL">Newfoundland and Labrador</option>
                                                        <option value="NS">Nova Scotia</option>
                                                        <option value="NT">Northwest Territories</option>
                                                        <option value="NU">Nunavut</option>
                                                        <option value="ON">Ontario</option>
                                                        <option value="PE">Prince Edward Island</option>
                                                        <option value="QC">Quebec</option>
                                                        <option value="SK">Saskatchewan</option>
                                                        <option value="YT">Yukon</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Current Status</Label>
                                                    <Select value={formData.currentStatus} onChange={e => setFormData({ ...formData, currentStatus: e.target.value })}>
                                                        <option value="">Select...</option>
                                                        <option value="visitor">Visitor</option>
                                                        <option value="student">Student (Study Permit)</option>
                                                        <option value="worker">Worker (Work Permit)</option>
                                                        <option value="other">Other</option>
                                                    </Select>
                                                </div>
                                                <div className="col-span-2 pt-3 border-t border-gray-100 mt-2">
                                                    <p className="text-xs font-medium text-gray-500 mb-3">MOST RECENT ENTRY (if different from original)</p>
                                                </div>
                                                <div>
                                                    <Label>Most Recent Entry Date (Optional)</Label>
                                                    <Input type="date" value={formData.mostRecentEntryDate} onChange={e => setFormData({ ...formData, mostRecentEntryDate: e.target.value })} />
                                                </div>
                                                <div>
                                                    <Label>Most Recent Entry City (Optional)</Label>
                                                    <Input value={formData.mostRecentEntryCity} onChange={e => setFormData({ ...formData, mostRecentEntryCity: e.target.value })} placeholder="e.g. Vancouver" />
                                                </div>
                                                <div className="col-span-2">
                                                    <Label>Most Recent Entry Province (Optional)</Label>
                                                    <Select value={formData.mostRecentEntryProvince} onChange={e => setFormData({ ...formData, mostRecentEntryProvince: e.target.value })}>
                                                        <option value="">Select Province...</option>
                                                        <option value="AB">Alberta</option>
                                                        <option value="BC">British Columbia</option>
                                                        <option value="MB">Manitoba</option>
                                                        <option value="NB">New Brunswick</option>
                                                        <option value="NL">Newfoundland and Labrador</option>
                                                        <option value="NS">Nova Scotia</option>
                                                        <option value="NT">Northwest Territories</option>
                                                        <option value="NU">Nunavut</option>
                                                        <option value="ON">Ontario</option>
                                                        <option value="PE">Prince Edward Island</option>
                                                        <option value="QC">Quebec</option>
                                                        <option value="SK">Saskatchewan</option>
                                                        <option value="YT">Yukon</option>
                                                    </Select>
                                                </div>
                                                <div className="col-span-2 pt-3 border-t border-gray-100 mt-2">
                                                    <p className="text-xs font-medium text-gray-500 mb-3">CURRENT STATUS DOCUMENT</p>
                                                </div>
                                                <div>
                                                    <Label>Document Type</Label>
                                                    <Select value={formData.permitDocType} onChange={e => setFormData({ ...formData, permitDocType: e.target.value })}>
                                                        <option value="">Select...</option>
                                                        <option value="study_permit">Study Permit</option>
                                                        <option value="work_permit">Work Permit</option>
                                                        <option value="visitor_record">Visitor Record</option>
                                                        <option value="trv">TRV Stamp</option>
                                                        <option value="other">Other</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label>Document Number</Label>
                                                    <Input value={formData.permitDocNumber} onChange={e => setFormData({ ...formData, permitDocNumber: e.target.value })} placeholder="e.g. U1234567" />
                                                </div>
                                                <div className="col-span-2">
                                                    <Label>Expiry Date of Current Status</Label>
                                                    <Input type="date" value={formData.permitExpiryDate} onChange={e => setFormData({ ...formData, permitExpiryDate: e.target.value })} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Travel History - Placeholder */}
                                <div>
                                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs">2</span>
                                        <span className="text-gray-400">Travel History</span>
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-2">Phase 2</span>
                                    </h3>
                                    <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/30 text-center text-sm text-gray-500">
                                        Travel history and previous visa applications will be available in a future update.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-1/3 bg-white flex flex-col">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-4">Actions</h3>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-gray-200 rounded text-gray-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">IMM5710</div>
                                        <div className="text-xs text-gray-500">Work Permit Extension</div>
                                    </div>
                                </div>
                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">PDF</span>
                            </div>

                            <div className="mb-4 text-xs text-gray-500 border-t border-gray-200 pt-3">
                                <div className="flex justify-between mb-1">
                                    <span>Linked job:</span>
                                    <span className="font-medium text-gray-900">Spring 2025 Welders</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <StatusBadge status="Draft" />
                                </div>
                            </div>

                            {genStatus === 'idle' && (
                                <Button onClick={handleGenerate} className="w-full">Generate PDF</Button>
                            )}

                            {genStatus === 'processing' && (
                                <Button disabled className="w-full bg-gray-100 text-gray-500 border border-gray-200 shadow-none">
                                    <Loader2 size={16} className="animate-spin" /> Generating...
                                </Button>
                            )}

                            {genStatus === 'success' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium bg-green-50 p-3 rounded border border-green-100">
                                        <CheckCircle2 size={16} /> Generation Successful
                                    </div>
                                    <Button variant="secondary" className="w-full" icon={<Download size={16} />}>Download Package</Button>
                                    <button onClick={() => setGenStatus('idle')} className="text-xs text-gray-500 w-full text-center hover:underline">Start Over</button>
                                </div>
                            )}

                            {genStatus === 'error' && (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2 text-sm text-red-700 font-medium bg-red-50 p-3 rounded border border-red-100">
                                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                                        <div>
                                            <div>Generation Failed</div>
                                            <div className="text-xs font-normal mt-1 text-red-600 opacity-90">Missing field: Passport Number is required.</div>
                                        </div>
                                    </div>
                                    <Button onClick={() => setGenStatus('idle')} variant="white" className="w-full">Edit Data & Retry</Button>
                                </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-gray-200 text-[10px] text-gray-400 text-center">
                                Representative: Default Org Rep (Jane Doe, RCIC #123456)
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-6 bg-gray-50/30 overflow-y-auto">
                        <h3 className="font-bold text-xs uppercase tracking-wide text-gray-400 mb-3">Validation Surface</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Identity & Contact</div>
                                <div className="space-y-2">
                                    {(!formData.familyName || !formData.givenNames) ? (
                                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Missing name fields</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded">
                                            <CheckCircle2 size={12} />
                                            <span>Identity complete</span>
                                        </div>
                                    )}

                                    {!formData.phone && (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Missing phone number (Warning)</span>
                                        </div>
                                    )}

                                    {!formData.countryOfResidence && (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Missing country of residence</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Passport & Travel Docs</div>
                                <div className="space-y-2">
                                    {!formData.passportNum ? (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Passport details incomplete (Blocker)</span>
                                        </div>
                                    ) : isPassportExpiringSoon() ? (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Passport valid (Expires within 6mo)</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded">
                                            <CheckCircle2 size={12} />
                                            <span>Passport valid</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Family</div>
                                <div className="space-y-2">
                                    {!formData.spouseRelationType ? (
                                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Spouse/partner status not set</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded">
                                            <CheckCircle2 size={12} />
                                            <span>Family info provided</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Application Readiness (IMM5710)</div>
                                <div className="space-y-2">
                                    {!formData.sex ? (
                                        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded">
                                            <AlertCircle size={12} />
                                            <span>Missing required field: Applicant Sex</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 px-3 py-2 rounded">
                                            <CheckCircle2 size={12} />
                                            <span>Ready to generate IMM5710</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
