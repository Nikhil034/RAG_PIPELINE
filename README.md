# RAG Tutorial

This project is a small React app with document upload and chat, backed by Supabase Edge Functions and Gemini.

Search uses hybrid retrieval: PostgreSQL full-text search finds exact terms while pgvector finds semantically similar chunks. The two ranked lists are combined with reciprocal rank fusion (RRF) before the selected chunks are sent to Gemini.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Sample documents

`demo-docs/northwind/` is a made-up company handbook (travel policy, IT helpdesk guide and more). The examples in the video and the notes use it: "cheap flights", "Can I book a business class flight?", "What does ERR_4021 mean?". `demo-docs/globex/` is a second company, used in the multi-tenant RLS extra.

## Backend setup

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor.
2. Create a Gemini API key and add it to Supabase Edge Function secrets as `GEMINI_API_KEY`.
3. Link the Supabase CLI to your project, then deploy the functions:

   ```bash
   supabase functions deploy ingest --no-verify-jwt
   supabase functions deploy chat --no-verify-jwt
   supabase functions deploy embed --no-verify-jwt
   ```

4. Configure the app's `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

For local development, install dependencies and start Vite:

```bash
npm install
npm run dev
```

Upload files from `demo-docs/northwind/`, then ask a question such as "Can I book a business class flight?" or "What does ERR_4021 mean?".

The schema grants access to the `anon` role for this no-login tutorial app. Do not use that access model for private or multi-user documents; add authentication, ownership policies, and row-level security before production use.
