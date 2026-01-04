<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18RCSLu-wZP4jKqzI3H0Mt6De2XsNg4Qi

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Connect to Supabase Postgres

1. Add the provided Postgres connection string to `.env.local` as `DATABASE_URL=...`.
2. Test connectivity with `npm run db:check` (loads `.env` then `.env.local`). This runs a simple `SELECT now()` using SSL against Supabase.

## Supabase Edge Functions

The frontend calls Supabase Edge Functions for server-only logic (document slots, uploads). Configure and deploy:

- Option A: set `VITE_SUPABASE_FUNCTION_URL=https://<your-project-ref>.supabase.co/functions/v1` in `.env.local`.
- Option B: omit it and we will fall back to `VITE_SUPABASE_URL/functions/v1`.
- Deploy functions (requires Supabase CLI auth): `supabase functions deploy document-slots upload-document`.
- For local/dev without login, allow anon access by setting secrets on the functions:  
  `supabase secrets set --env-file .env.local ALLOW_ANON_DOCUMENT_SLOTS=true ALLOW_ANON_DOCUMENT_UPLOAD=true`
