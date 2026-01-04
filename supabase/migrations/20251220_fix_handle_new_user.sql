-- Fix handle_new_user to avoid invalid org_id casts during OAuth signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    desired_org_id uuid;
    raw_org_id text;
BEGIN
    raw_org_id := NEW.raw_user_meta_data->>'org_id';

    IF raw_org_id IS NOT NULL AND raw_org_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        desired_org_id := raw_org_id::uuid;
    END IF;

    IF desired_org_id IS NULL THEN
        desired_org_id := '00000000-0000-0000-0000-000000000001'::uuid;
        INSERT INTO public.organizations (id, name)
        VALUES (desired_org_id, 'Default Organization')
        ON CONFLICT (id) DO NOTHING;
    END IF;

    INSERT INTO public.users (id, email, display_name, org_id, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'full_name',
            split_part(NEW.email, '@', 1)
        ),
        desired_org_id,
        'user'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.users TO supabase_auth_admin;
GRANT ALL ON public.organizations TO supabase_auth_admin;
