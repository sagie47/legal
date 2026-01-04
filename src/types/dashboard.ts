// Dashboard data types per PRD Section 6

export interface DashboardKPIs {
    activeLmiasCount: number;
    lmiasDeltaWeek: number;
    pendingWorkPermitsCount: number;
    pendingWpAvgWaitDays: number;
    expiringSoonCount: number;
    placedYtdCount: number;
    placedYtdDeltaPercent: number;
}

export interface CohortSummary {
    id: string;
    name: string;
    employerName: string;
    locationCity: string;
    locationProvince: string;
    workersCurrent: number;
    workersTarget: number;
    status: 'draft' | 'ready' | 'submitted' | 'approved' | 'closed';
    workPermitStatus: string;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
    primaryActionLabel: string;
    primaryActionUrl: string;
    lastUpdatedAt: string;
}

export interface ComplianceAlert {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    linkedResourceType: 'cohort' | 'applicant' | 'employer' | 'global';
    linkedResourceId: string;
    createdAt: string;
}
