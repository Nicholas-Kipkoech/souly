# Soully — Tailwind CSS + Next.js + Supabase starter

Soully is a dating-app MVP starter built with Next.js App Router, React, Tailwind CSS v4, Lucide icons, and Supabase.

## Requirements
- Node.js 20.9 or newer
- A Supabase project

## Run locally
1. Extract the ZIP and open the `soully-tailwind` folder in a terminal.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local` and add your Supabase project URL and publishable key.
4. In Supabase SQL Editor, run `supabase/schema.sql` if you have not created the `profiles` table yet.
5. Run `supabase/discovery-migration.sql` in Supabase SQL Editor to add swipe decisions and automatic mutual matches. It is safe to run this migration after the starter profile schema exists.
6. In Supabase Authentication settings, enable Email auth and set the Site URL to your local origin (`http://localhost:3000`). Add `http://localhost:3000/auth/callback` to allowed redirect URLs.
7. Start the app: `npm run dev`
8. Open `http://localhost:3000`.

## Current features
- Responsive Soully landing page
- Email sign-up/login and email confirmation callback
- Profile setup and profile saving
- Discover cards loaded from Supabase profiles
- Like and pass actions saved to Supabase
- Automatic mutual-match rows created when both users like each other
- Match count dialog (chat is not implemented yet)

## Testing discovery
1. Create two separate test accounts in your app.
2. Complete profile setup for both accounts.
3. Open `/discover` with account A and like account B.
4. Sign in as account B and like account A.
5. Sign back in as either account and open the Matches button. The mutual match count should increase.

A pass or like is stored so the same profile will not appear again for that account. To test again, delete the relevant row from `public.swipes` in Supabase SQL Editor or use fresh test accounts.

## Important security notes
- The existing starter `profiles` select policy allows every authenticated user to read every profile row. This is a prototype shortcut, **not production-ready privacy**. Before launch, replace it with a server-mediated discovery query or a safer public-profile table that excludes sensitive fields, and add blocks/reports, moderation, rate limits, secure photo storage, age/consent safeguards, and privacy/legal pages.
- Do not expose a Supabase service-role key in any `NEXT_PUBLIC_*` variable.
- This starter only counts matches; it does not yet implement messaging, notifications, photo uploads, blocking, reporting, or identity/age verification.
- Store badges, social links, sample testimonials, and sample landing-page images are placeholders. Replace them with real store links and properly licensed/consented assets before public launch.
