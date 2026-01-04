import React, { useState, useMemo, useEffect } from 'react';
import {
    LayoutDashboard,
    Layers,
    Users,
    Building2,
    Shield,
    FileText,
    LogOut,
    UploadCloud,
    Plus,
    FileText as FileIcon,
    Clock,
    AlertTriangle,
    UserCheck,
    Search,
    Filter,
    AlertCircle,
    ArrowRight,
    Zap,
    CheckCircle2,
    X,
    Sparkles
} from 'lucide-react';
import { Logo, Button, StatusBadge } from './src/components/ui';
import { NewCaseModal, Workspace, CaseList, CaseView, APPLICATION_STREAMS } from './src/features/cases';
import { EmployerModal } from './src/features/cases/EmployerModal';
import { CohortModal } from './src/features/cases/CohortModal';
import { getDashboardStats, getActiveCohorts, getComplianceAlerts } from './src/services/dashboard';
import { deleteApplication } from './src/services/applications';
import { CaseProvider } from './src/context/CaseContext';
import { useAuth } from './src/features/auth';
import { ChatbotPanel } from './src/features/chatbot';


// --- Helper Functions ---

const getTimeOfDayGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
};

// --- Sub-Components ---

const SidebarItem = ({ icon: Icon, label, active = false, badge, onClick }: { icon: any, label: string, active?: boolean, badge?: string, onClick?: () => void }) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 font-medium rounded-md text-sm transition-colors ${active ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50 hover:text-black'}`}>
        <Icon size={18} />
        {label}
        {badge && <span className="ml-auto bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
    </button>
);

// Skeleton loader for metric cards
const MetricCardSkeleton = () => (
    <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm animate-pulse">
        <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-gray-200 rounded-md"></div>
            <div className="w-16 h-5 bg-gray-200 rounded"></div>
        </div>
        <div className="w-16 h-8 bg-gray-200 rounded mb-2"></div>
        <div className="w-24 h-4 bg-gray-200 rounded"></div>
    </div>
);

const MetricCard = ({ stat, isLoading, error, onRetry, onClick }: { stat: any, isLoading?: boolean, error?: boolean, onRetry?: () => void, onClick?: () => void }) => {
    if (isLoading) return <MetricCardSkeleton />;

    if (error) {
        return (
            <div className="bg-white p-5 rounded-lg border border-red-200 shadow-sm">
                <div className="flex items-center gap-2 text-red-600 mb-2">
                    <AlertCircle size={16} />
                    <span className="text-sm font-medium">Failed to load</span>
                </div>
                <button onClick={onRetry} className="text-xs text-blue-600 hover:underline">Retry</button>
            </div>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`bg-white p-5 rounded-lg border shadow-sm transition-all hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''} ${stat.alert ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'}`}
        >
            <div className="flex justify-between items-start mb-3">
                <div className={`p-2 rounded-md ${stat.alert ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                    <stat.icon size={20} />
                </div>
                {stat.trendUp !== null && (
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${stat.trendUp ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                        {stat.trend}
                    </span>
                )}
                {stat.trendUp === null && (
                    <span className="text-[11px] font-medium text-gray-400">{stat.trend}</span>
                )}
            </div>
            <div className="text-3xl font-bold tracking-tight mb-1">{stat.value}</div>
            <div className="text-sm text-gray-500 font-medium">{stat.label}</div>
        </div>
    );
};

// Skeleton for table rows
const CohortRowSkeleton = () => (
    <tr className="animate-pulse">
        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-40"></div><div className="h-3 bg-gray-200 rounded w-24 mt-2"></div></td>
        <td className="px-5 py-4"><div className="h-2 bg-gray-200 rounded w-16"></div></td>
        <td className="px-5 py-4"><div className="h-5 bg-gray-200 rounded w-16"></div></td>
        <td className="px-5 py-4"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
        <td className="px-5 py-4 text-right"><div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div></td>
    </tr>
);

const CohortTable = ({
    cohorts,
    isLoading,
    onRowClick,
    onActionClick,
    onCreateNew
}: {
    cohorts: any[],
    isLoading?: boolean,
    onRowClick?: (id: number) => void,
    onActionClick?: (cohort: any) => void,
    onCreateNew?: () => void
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Debounced search (simple implementation)
    const filteredCohorts = useMemo(() => {
        if (!searchQuery.trim()) return cohorts;
        const q = searchQuery.toLowerCase();
        return cohorts.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.location && c.location.toLowerCase().includes(q))
        );
    }, [cohorts, searchQuery]);

    // Sort: Risk (High→None) → Status (Ready→Draft) → lastUpdated
    const sortedCohorts = useMemo(() => {
        const riskOrder: Record<string, number> = { 'High': 0, 'Medium': 1, 'Low': 2, 'None': 3 };
        const statusOrder: Record<string, number> = { 'Ready': 0, 'Submitted': 1, 'Draft': 2, 'Approved': 3, 'Action Required': 1 };

        return [...filteredCohorts].sort((a, b) => {
            const riskDiff = (riskOrder[a.risk] ?? 4) - (riskOrder[b.risk] ?? 4);
            if (riskDiff !== 0) return riskDiff;
            const statusDiff = (statusOrder[a.lmia] ?? 5) - (statusOrder[b.lmia] ?? 5);
            return statusDiff;
        });
    }, [filteredCohorts]);

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Layers size={18} className="text-gray-400" /> Active Cohorts
                </h3>
                <div className="flex gap-2 items-center">
                    {showSearch && (
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2">
                            <Search size={14} className="text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search cohorts..."
                                className="text-sm py-1 w-40 focus:outline-none"
                                autoFocus
                            />
                            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-gray-400 hover:text-gray-600">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    {!showSearch && (
                        <button onClick={() => setShowSearch(true)} className="p-1.5 hover:bg-gray-200 rounded text-gray-500"><Search size={16} /></button>
                    )}
                    <button className="p-1.5 hover:bg-gray-200 rounded text-gray-500"><Filter size={16} /></button>
                </div>
            </div>

            <div className="overflow-x-auto flex-1">
                {isLoading ? (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 font-medium">
                                <th className="px-5 py-3 font-medium">Cohort / Employer</th>
                                <th className="px-5 py-3 font-medium">Workers</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Risk</th>
                                <th className="px-5 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3].map(i => <CohortRowSkeleton key={i} />)}
                        </tbody>
                    </table>
                ) : sortedCohorts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        {searchQuery ? (
                            <>
                                <Search size={32} className="text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm">No cohorts match your search.</p>
                            </>
                        ) : (
                            <>
                                <Layers size={32} className="text-gray-300 mb-3" />
                                <p className="text-gray-500 text-sm mb-4">No cohorts yet. Create your first cohort to get started.</p>
                                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={onCreateNew}>Create your first cohort</Button>
                            </>
                        )}
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200 font-medium">
                                <th className="px-5 py-3 font-medium">Cohort / Employer</th>
                                <th className="px-5 py-3 font-medium">Workers</th>
                                <th className="px-5 py-3 font-medium">Status</th>
                                <th className="px-5 py-3 font-medium">Risk</th>
                                <th className="px-5 py-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedCohorts.map((cohort) => (
                                <tr
                                    key={cohort.id}
                                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                                    onClick={() => onRowClick?.(cohort.id)}
                                >
                                    <td className="px-5 py-4">
                                        <div className="font-bold text-gray-900">{cohort.name}</div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                            <Building2 size={10} /> {cohort.location}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-2">
                                            {/* Mock progress for now as schema doesn't have it yet */}
                                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-black rounded-full"
                                                    style={{ width: '10%' }}
                                                ></div>
                                            </div>
                                            <span className="font-mono text-xs text-gray-600">
                                                {cohort.workersCurrent || 0}/{cohort.jobDetails?.targetWorkers || 0}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-1 items-start">
                                            <StatusBadge status={cohort.status} />
                                            {/* WP status placeholder */}
                                            <span className="text-[10px] text-gray-400">WP: -</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        {cohort.riskLevel === 'high' && (
                                            <span className="text-red-600 text-xs font-bold flex items-center gap-1"><AlertCircle size={12} /> High</span>
                                        )}
                                        {cohort.riskLevel === 'medium' && (
                                            <span className="text-amber-600 text-xs font-bold flex items-center gap-1"><AlertTriangle size={12} /> Med</span>
                                        )}
                                        {cohort.riskLevel === 'low' && (
                                            <span className="text-gray-400 text-xs flex items-center gap-1">Low</span>
                                        )}
                                        {cohort.riskLevel === 'none' && (
                                            <span className="text-gray-300 text-xs flex items-center gap-1">--</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <button
                                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                            onClick={(e) => { e.stopPropagation(); onActionClick?.(cohort); }}
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            {sortedCohorts.length > 0 && (
                <div className="p-3 border-t border-gray-100 text-center">
                    <button className="text-xs font-medium text-gray-500 hover:text-black transition-colors">View All Cohorts</button>
                </div>
            )}
        </div>
    );
};

const ComplianceRadar = ({ alerts, isLoading, onAlertClick }: { alerts: any[], isLoading?: boolean, onAlertClick?: (alert: any) => void }) => {
    // Sort by severity (critical first) then recency
    const sortedAlerts = useMemo(() => {
        const severityOrder: Record<string, number> = { 'critical': 0, 'warning': 1, 'info': 2 };
        return [...alerts].sort((a, b) => {
            const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
            return sevDiff;
        });
    }, [alerts]);

    const displayedAlerts = sortedAlerts.slice(0, 5);

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Shield size={18} className="text-[var(--accent)]" /> Compliance Radar
                </h3>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex gap-3 p-3 rounded-md bg-gray-50">
                            <div className="w-2 h-2 bg-gray-200 rounded-full mt-1"></div>
                            <div className="flex-1">
                                <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                                <div className="h-2 bg-gray-200 rounded w-32"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : alerts.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-center">
                    <CheckCircle2 size={32} className="text-green-500 mb-3" />
                    <p className="text-sm text-gray-600 font-medium">No active compliance alerts.</p>
                    <p className="text-xs text-gray-400 mt-1">You're in the clear for now.</p>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        {displayedAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="flex gap-3 p-3 rounded-md bg-gray-50 border border-gray-100 hover:border-gray-300 transition-colors cursor-pointer group"
                                onClick={() => onAlertClick?.(alert)}
                            >
                                <div className={`mt-0.5 min-w-[6px] w-[6px] h-[6px] rounded-full ${alert.severity === 'critical' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-400'}`}></div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-gray-900 group-hover:text-[var(--accent)] transition-colors">{alert.title || alert.type}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 leading-snug truncate">{alert.message}</div>
                                    {/* Time would need moment/date-fns since server returns ISO string */}
                                    <div className="text-[10px] text-gray-400 mt-2 font-mono">{alert.createdAt ? new Date(alert.createdAt).toLocaleTimeString() : ''}</div>
                                </div>
                                <ArrowRight size={14} className="text-gray-300 ml-auto self-center group-hover:translate-x-1 transition-transform flex-shrink-0" />
                            </div>
                        ))}
                    </div>

                    {alerts.length > 5 && (
                        <button className="w-full mt-3 text-xs font-medium text-blue-600 hover:underline">
                            View all in Risk Center →
                        </button>
                    )}
                </>
            )}

            <button className="w-full mt-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-600 rounded hover:bg-gray-50 transition-colors">
                Run Compliance Check
            </button>
        </div>
    );
};

// --- Main Dashboard View ---

export const Dashboard = ({ onLogout }: { onLogout: () => void }) => {
    const { profile, loading: authLoading } = useAuth();
    const orgId = profile?.orgId || '';

    // Only use real org ID - no fallback to prevent wrong queries
    const effectiveOrgId = orgId;

    const [view, setView] = useState<'dashboard' | 'applicants' | 'case' | 'workspace' | 'chatbot'>('dashboard');
    const [showNewCaseModal, setShowNewCaseModal] = useState(false);
    const [activeCase, setActiveCase] = useState<any>(null);
    const [caseRefreshKey, setCaseRefreshKey] = useState(0);

    // New Modals State
    const [showEmployerModal, setShowEmployerModal] = useState(false);
    const [showCohortModal, setShowCohortModal] = useState(false);

    // Data State
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>({});
    const [cohorts, setCohorts] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<any[]>([]);

    // Fetch Data on Mount
    const refreshData = async () => {
        if (!effectiveOrgId) return; // Wait for auth
        setIsLoading(true);
        try {
            const [statsData, cohortsData, alertsData] = await Promise.all([
                getDashboardStats(effectiveOrgId),
                getActiveCohorts(effectiveOrgId),
                getComplianceAlerts(effectiveOrgId)
            ]);

            setStats({
                activeLmias: { label: "Active LMIAs", value: statsData.activeLmiasCount, trend: "+0 this week", trendUp: true, icon: FileIcon },
                pendingWorkPermits: { label: "Pending Work Permits", value: statsData.pendingWorkPermitsCount, trend: `Avg wait: ${statsData.pendingWpAvgWaitDays} days`, trendUp: null, icon: Clock },
                expiring: { label: "Expiring < 90 Days", value: statsData.expiringSoonCount, trend: statsData.expiringSoonCount > 0 ? "Action Needed" : "All good", trendUp: statsData.expiringSoonCount === 0, alert: statsData.expiringSoonCount > 0, icon: AlertTriangle },
                placed: { label: "Placed YTD", value: statsData.placedYtdCount, trend: "+0% vs 2024", trendUp: true, icon: UserCheck },
            });

            // Transform cohorts for UI (flatten jobDetails)
            const formattedCohorts = cohortsData.map((c: any) => ({
                ...c,
                location: `${c.jobDetails?.locationCity}, ${c.jobDetails?.locationProvince}`
            }));
            setCohorts(formattedCohorts);
            setAlerts(alertsData);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, [effectiveOrgId]);

    // Handle opening a case - navigates to dedicated case view
    const handleOpenCase = (caseData: any) => {
        setActiveCase(caseData);
        setView('case');
    };

    // Handle editing a case - goes to workspace
    const handleEditCase = () => {
        if (activeCase) {
            setView('workspace');
        }
    };

    const handleDeleteCase = async (caseData: any) => {
        const caseOrgId = caseData?.raw?.org_id || effectiveOrgId;
        if (!caseOrgId) {
            throw new Error('Organization not available for deletion.');
        }
        await deleteApplication(caseData.id, caseOrgId);
        setActiveCase(null);
        setView('applicants');
        setCaseRefreshKey((prev) => prev + 1);
    };


    // Derive critical alert count
    const criticalAlertCount = alerts.filter(a => a.severity === 'critical').length;

    const shouldOffsetSidebar = !(view === 'workspace' || view === 'case');
    const showFullWidthContent = view === 'chatbot';

    return (
        <div className="min-h-screen bg-[#F9F9F7] flex text-[#050505]">
            {/* Sidebar - PRD 4.1 */}
            <aside className={`w-64 bg-white border-r border-gray-200 fixed h-full z-20 hidden lg:flex flex-col transition-all duration-300 ${(view === 'workspace' || view === 'case') ? '-ml-64' : ''}`}>
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <Logo />
                </div>

                <div className="p-4 space-y-1 flex-1 overflow-y-auto">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-2">Operations</div>
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" active={view === 'dashboard'} onClick={() => { setView('dashboard'); setActiveCase(null); }} />
                    <SidebarItem icon={Layers} label="Cohorts" />
                    <SidebarItem icon={Users} label="Applicants" active={view === 'applicants'} onClick={() => { setView('applicants'); setActiveCase(null); }} />
                    <SidebarItem icon={Building2} label="Employers" onClick={() => setShowEmployerModal(true)} />

                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-6">Compliance</div>
                    <SidebarItem icon={Shield} label="Risk Center" badge={criticalAlertCount > 0 ? String(criticalAlertCount) : undefined} />
                    <SidebarItem icon={FileText} label="Audit Logs" />

                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-3 mb-2 mt-6">Support</div>
                    <SidebarItem icon={Sparkles} label="AI Assistant" active={view === 'chatbot'} onClick={() => { setView('chatbot'); setActiveCase(null); }} />



                </div>

                <div className="p-4 border-t border-gray-100">
                    <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2 text-gray-500 hover:text-red-600 font-medium rounded-md text-sm transition-colors">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 transition-all duration-300 ${shouldOffsetSidebar ? 'lg:ml-64' : ''} ${(view === 'dashboard' || view === 'cases') ? 'p-4 md:p-8' : ''}`}>

                {view === 'dashboard' ? (
                    <>
                        {/* Dashboard Header - PRD 5.1 */}
                        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{getTimeOfDayGreeting()}, Alex.</h1>
                                <p className="text-gray-500 text-sm mt-1">
                                    {criticalAlertCount > 0 ? (
                                        <>You have <span className="font-medium text-black">{criticalAlertCount} critical alert{criticalAlertCount > 1 ? 's' : ''}</span> requiring attention today.</>
                                    ) : (
                                        <>All systems running smoothly. No critical alerts.</>
                                    )}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="white" icon={<UploadCloud size={16} />} size="sm">Import CSV</Button>
                                <Button variant="primary" icon={<Plus size={16} />} size="sm" onClick={() => setShowCohortModal(true)}>New Cohort</Button>
                            </div>
                        </header>

                        {/* Stats Row - PRD 5.2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {stats.activeLmias && <MetricCard stat={stats.activeLmias} isLoading={isLoading} />}
                            {stats.pendingWorkPermits && <MetricCard stat={stats.pendingWorkPermits} isLoading={isLoading} />}
                            {stats.expiring && <MetricCard stat={stats.expiring} isLoading={isLoading} />}
                            {stats.placed && <MetricCard stat={stats.placed} isLoading={isLoading} />}
                        </div>

                        {/* Dashboard Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 flex flex-col gap-4">
                                <CohortTable
                                    cohorts={cohorts}
                                    isLoading={isLoading}
                                    onCreateNew={() => setShowCohortModal(true)}
                                />
                            </div>

                            <div className="flex flex-col gap-4">
                                <ComplianceRadar alerts={alerts} isLoading={isLoading} />

                                {/* Helper Card */}
                                <div className="bg-black text-white rounded-lg p-5 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-20">
                                        <Zap size={48} />
                                    </div>
                                    <h4 className="font-bold text-sm mb-2 relative z-10">Job Bank Sync</h4>
                                    <p className="text-xs text-gray-400 mb-4 relative z-10 leading-relaxed">
                                        Auto-sync is enabled. 3 new wage updates detected for NOC 2171.
                                    </p>
                                    <button className="text-[10px] font-bold uppercase tracking-widest text-[var(--accent)] hover:text-white transition-colors">Review Updates</button>
                                </div>
                            </div>
                        </div>
                    </>
                ) : view === 'applicants' ? (
                    // Applicants view - wait for auth before rendering
                    authLoading ? (
                        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto mb-3"></div>
                                <p className="text-sm text-gray-500">Loading your workspace...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="h-[calc(100vh-4rem)] overflow-auto">
                            <CaseList
                                onOpenCase={handleOpenCase}
                                onCreateNew={() => setShowNewCaseModal(true)}
                                orgId={effectiveOrgId}
                                bypassOrgFilter={true}
                                refreshKey={caseRefreshKey}
                            />
                        </div>
                    )
                ) : view === 'case' ? (
                    activeCase ? (
                        <div className="h-[calc(100vh-4rem)] overflow-hidden">
                            <CaseView
                                caseData={activeCase}
                                onBack={() => { setView('applicants'); setActiveCase(null); }}
                                onCreateNew={() => setShowNewCaseModal(true)}
                                onEdit={handleEditCase}
                                onDelete={handleDeleteCase}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <div className="text-center space-y-2">
                                <div className="text-lg font-semibold">No case selected</div>
                                <p className="text-sm">Choose a case from the applicants list to view details.</p>
                                <Button onClick={() => setView('applicants')}>Go to Applicants</Button>
                            </div>
                        </div>
                    )

                ) : view === 'chatbot' ? (
                    // AI Chatbot View
                    <div className="h-[calc(100vh-2rem)] p-4 md:p-8">
                        <ChatbotPanel />
                    </div>
                ) : (
                    // Workspace View (Full Screen) - only when view === 'workspace'
                    activeCase ? (
                        <CaseProvider caseData={activeCase}>
                            <Workspace
                                caseData={activeCase}
                                onBack={() => setView('case')}
                            />
                        </CaseProvider>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <div className="text-center space-y-2">
                                <div className="text-lg font-semibold">No case selected</div>
                                <p className="text-sm">Choose a case from the applicants list to open the workspace.</p>
                                <Button onClick={() => setView('applicants')}>Go to Applicants</Button>
                            </div>
                        </div>
                    )
                )}
            </main>

            <NewCaseModal
                isOpen={showNewCaseModal}
                onClose={() => setShowNewCaseModal(false)}
                onCreate={(caseData) => {
                    setActiveCase(caseData);
                    setView('workspace');
                }}
                orgId={effectiveOrgId}
            />

            <EmployerModal
                isOpen={showEmployerModal}
                onClose={() => setShowEmployerModal(false)}
                onSuccess={(employer) => {
                    console.log('Employer created:', employer);
                    // Ideally show a toast
                }}
                orgId={effectiveOrgId}
            />

            <CohortModal
                isOpen={showCohortModal}
                onClose={() => setShowCohortModal(false)}
                onSuccess={(cohort) => {
                    console.log('Cohort created:', cohort);
                    refreshData(); // Refresh list
                }}
                orgId={effectiveOrgId}
            />
        </div>
    );
};
