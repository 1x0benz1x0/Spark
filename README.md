# MCHS Chat — Instagram-style social app for school

Built with Next.js (App Router), Tailwind CSS, and Supabase. Free to host on Vercel.

## Setup

1. Create a free Supabase project at https://supabase.com
2. In the Supabase SQL editor, run `supabase/schema.sql` to create tables.
3. In Supabase → Storage, create a public bucket named `posts`.
4. Copy `.env.local.example` to `.env.local` and fill in your Supabase URL + anon key.
5. `npm run dev` → http://localhost:3000
6. Deploy to Vercel (import the repo, add the env vars).

## Env vars

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
