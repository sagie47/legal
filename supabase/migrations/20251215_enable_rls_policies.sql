-- Enable RLS and add policies for multi-tenant database access
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)

-- ============================================================
-- 1. USERS TABLE - Allow reading own profile
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);

-- ============================================================
-- 2. ORGANIZATIONS TABLE - Members can read their org
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read org" ON public.organizations;
CREATE POLICY "Org members can read org" 
ON public.organizations FOR SELECT 
USING (
    id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 3. APPLICANTS TABLE - Full CRUD within org
-- ============================================================
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to applicants" ON public.applicants;
CREATE POLICY "Org access to applicants" 
ON public.applicants FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 4. APPLICATIONS TABLE - Full CRUD within org
-- ============================================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to applications" ON public.applications;
CREATE POLICY "Org access to applications" 
ON public.applications FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 5. COHORTS TABLE - Full CRUD within org
-- ============================================================
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to cohorts" ON public.cohorts;
CREATE POLICY "Org access to cohorts" 
ON public.cohorts FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 6. EMPLOYERS TABLE - Full CRUD within org
-- ============================================================
ALTER TABLE public.employers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to employers" ON public.employers;
CREATE POLICY "Org access to employers" 
ON public.employers FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 7. DOCUMENTS TABLE - Full CRUD within org
-- ============================================================
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to documents" ON public.documents;
CREATE POLICY "Org access to documents" 
ON public.documents FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);

-- ============================================================
-- 8. COMPLIANCE_ALERTS TABLE - Read within org
-- ============================================================
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org access to compliance_alerts" ON public.compliance_alerts;
CREATE POLICY "Org access to compliance_alerts" 
ON public.compliance_alerts FOR ALL 
USING (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
)
WITH CHECK (
    org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
);
