# UKECareers Operations Tracker 2026/27

Static site (no build step): `index.html`, `theme.css`, `sync.js`, `config.js`. Deploy on Vercel/GitHub Pages as-is.

## One-time setup (≈15 min)
1. **Supabase** → New project. Note the Project URL and the **anon public** key (Settings → API).
2. SQL Editor → run `supabase/schema.sql`, then `supabase/seed.sql` (your JSON/CSV data: 49 tasks, 24 sponsors, 6 initiatives, 63 glossary entries, 30 log entries, 7 availability entries, profile). Seed is re-runnable and never overwrites edits.
3. Before step 2's members insert finishes, edit the `members` list in `schema.sql` with the 13 real emails (or add rows later in Table Editor → `members`).
4. Authentication → Providers → Email: **disable "Allow new users to sign up"**. Add the 13 users under Authentication → Users (Invite or "Add user" with a password). Set Site URL to your Vercel URL (needed for magic links).
5. Database → Replication: confirm `records` is enabled for Realtime (the SQL does this).
6. Paste URL + anon key into `config.js`, push to GitHub; Vercel redeploys.

## Security
- The anon key in `config.js` is public by design. **Never** use the service_role key in the frontend.
- RLS: only emails listed in `members` can read/write; there is no DELETE policy, so deploys and browsers can't wipe data (deletions are soft tombstones).
- Deploying code never touches the database.

## How sync works
Records live in one table (`coll`, `id`, `data` jsonb, `version`). Saves go through `save_record()` which rejects stale edits (you're told, shown the latest version, and nothing is silently overwritten). Realtime pushes changes to every open screen; status pill shows Saving / Saved / Offline, last-updated time and who is online. After a disconnect the app reconnects and refetches.

## Notes
- Sponsor tier is now **Potential Sponsors** (existing data migrates automatically). Glossary short codes are no longer shown.
- Without config the app runs locally with the embedded data ("Not connected").
- localStorage is only a UI cache/"Viewing as" preference; Supabase is the source of truth.
