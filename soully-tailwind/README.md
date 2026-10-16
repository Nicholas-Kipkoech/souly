# Soully — Tailwind CSS + Next.js + Supabase starter

This rebuild uses **Tailwind CSS v4 utility classes** throughout the homepage, auth page, and profile form. The old large page-specific CSS classes are no longer required. The warm pink/cream palette and Manrope + DM Sans typography are retained.

## Requirements
- Node.js 20.9 or newer
- A Supabase project (optional for previewing the homepage; required for auth/profile saving)

## Run locally
1. Extract this ZIP and open the project folder in a terminal.
2. Install packages: `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable key.
4. In Supabase SQL Editor, run `supabase/schema.sql`.
5. In Supabase Authentication settings, enable Email auth and set the Site URL to your local origin (`http://localhost:3000`). Add `http://localhost:3000/auth/callback` to allowed redirect URLs.
6. Start the app: `npm run dev`
7. Open `http://localhost:3000`.

The landing page can be browsed before configuring Supabase. Auth/profile routes require valid environment variables.

## Tailwind setup
- `tailwindcss` and `@tailwindcss/postcss` are Tailwind v4 packages.
- `postcss.config.mjs` enables the Tailwind PostCSS plugin.
- `app/globals.css` imports Tailwind and declares the Soully theme tokens.
- `next.config.ts` deliberately contains no `@tailwindcss/turbopack` loader. Do not add that loader; it is not the Tailwind v4 setup.

## Current scope
Included: responsive marketing homepage, email sign-up/login, email confirmation callback, profile setup/save, starter discover placeholder.
Not yet included: live discovery/matching, likes, mutual matches, messaging, image upload, age/identity verification, reporting/blocking, moderation, privacy/legal pages, push notifications, mobile app packaging. Store badges and social links are placeholders. Testimonials and sample profile photos are illustrative; replace them with properly licensed assets and real consented testimonials before public launch.

## Security before production
The sample SQL select policy allows authenticated users to read every row in `profiles`. It is a prototype shortcut, **not production-ready privacy**. Implement field-level privacy and a server-mediated discovery query before launch, add storage policies, validate age/consent and profile data on the server, implement blocking/reporting/moderation, rate limits, and review applicable privacy and dating-app requirements. Never expose a Supabase service-role key in `NEXT_PUBLIC_*` variables.
