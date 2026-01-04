-- Allow multiple auth identities with the same email
ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_email_unique;
