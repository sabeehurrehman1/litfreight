# LITFREIGHT — deployable website bundle

**Brand:** LITFREIGHT — Lux International Trade & Freight  
**Domain:** https://litfreight.co  
**Frontend:** static HTML/CSS/JavaScript (Cloudflare Pages)  
**Backend:** Supabase (Auth + PostgreSQL + Row Level Security)  

This bundle keeps the approved customer-facing design and puts shipment tracking at the very top of the homepage. It includes a real Supabase-backed guest buying request form, freight quote form, product enquiry form, email/password registration and login, supplier product submission, and public-safe shipment tracking. Tracking is LITFREIGHT's own system; it is not connected to DFS Cargo.

## 1. Create the free backend

1. Create a project at https://supabase.com/ (choose a region close to your customers; London is suitable for a UK-focused service).
2. In Supabase open **SQL Editor → New query**.
3. Open `supabase/schema.sql`, copy the complete contents, paste into SQL Editor and press **Run**.
4. Open **Project Settings → API**. Copy the **Project URL** and **anon / publishable key**.
5. Open `config.js` and replace the two placeholder strings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   The anon key is designed for browser use. **Never place a `service_role` or secret key in website files or GitHub.**
6. In Supabase **Authentication → URL Configuration**, set Site URL to `https://litfreight.co` and add `https://litfreight.co/**` and your Cloudflare Pages preview URL to Redirect URLs.
7. In Authentication → Providers, keep Email enabled. Set email confirmation according to your preference; enable it before public launch.

## 2. Create your first admin account

1. Open the deployed website and use **Create account** to register your own business email.
2. Verify the email if confirmation is enabled.
3. In Supabase → SQL Editor run this query, replacing the email with the exact email used above:

```sql
update public.profiles p
set role = 'admin', verified = true
from auth.users u
where p.id = u.id and lower(u.email) = lower('YOUR-ADMIN-EMAIL@EXAMPLE.COM');
```

Only an admin profile can manage private requests, listings, shipments and tracking events under the supplied database policies.

## 3. Deploy to GitHub + Cloudflare Pages

1. Create a GitHub repository named `litfreight`.
2. Upload **all files and folders** from this bundle. `index.html` must be in the repository root (not inside another nested folder).
3. In Cloudflare Dashboard open **Workers & Pages → Create → Pages → Connect to Git**.
4. Select the `litfreight` repository.
5. Framework preset: **None**. Build command: leave blank. Build output directory: `/` (root).
6. Deploy. Cloudflare will provide a `*.pages.dev` preview URL.
7. In Cloudflare Pages → Custom domains, add `litfreight.co` and `www.litfreight.co` if you want both. Follow Cloudflare's DNS prompts. Your domain is already delegated to Cloudflare, so do not randomly change nameservers again.
8. Set the same production URL in Supabase Auth URL Configuration.

## 4. Add a shipment and tracking updates

Tracking is available to visitors without login. Only the public tracking number, status, route and event history are returned by the tracking function; customer names, phone numbers, email addresses and internal notes are not exposed.

In Supabase → Table Editor:

1. Add a row to `shipments`, e.g. `tracking_no = LIT-2026-0001`, `status = Booked`, `origin = Lahore, Pakistan`, `destination = London, UK`.
2. Copy that shipment's `id`.
3. Add a row to `shipment_events` with that `shipment_id`, a status such as `Booked`, location and a customer-safe note.
4. When the shipment moves, update `shipments.status` and add a new `shipment_events` row. The public tracking form at the top of the website will show the history.

Suggested status order: **Booked → Processing → Dispatched → In Transit → Out for Delivery → Delivered**. Use **On Hold** only when needed.

## 5. Review incoming requests and listings

For the initial launch, use Supabase → Table Editor as the private operations console:

- `buying_requests`: review guest buying requests; change `status` to `approved` or `rejected`.
- `freight_quotes`: review freight quote requests and update status.
- `product_enquiries`: review customer enquiries.
- `products`: review seller submissions; change `status` to `approved` to approve a listing.
- `profiles`: verify business accounts and assign roles.
- `shipments` + `shipment_events`: create/update tracking.

A branded in-website admin dashboard, supplier messaging, payment processing, image uploads, automatic email/SMS notifications, and third-party/DFS tracking integration are **not included as completed features in this first deployment bundle**. They require additional implementation and provider configuration. Do not advertise these as active until built and tested.

## 6. Important security notes

- Never expose the Supabase service-role key in `config.js`, HTML, JavaScript, or GitHub.
- Keep RLS enabled. The supplied schema enables RLS on all business tables.
- Public visitors can submit enquiries but cannot read private contact details or admin records.
- The public tracking RPC returns only a restricted JSON response.
- Use strong passwords and enable email confirmation. Add Cloudflare Turnstile/rate limiting before a high-volume public launch.
- Test all forms and a sample tracking reference on the Cloudflare Pages preview URL before pointing customers to the site.

## Files

- `index.html` — customer website and responsive design
- `app.js` — Supabase-connected form, login, and tracking logic
- `config.js` — public Supabase URL and anon key placeholders
- `supabase/schema.sql` — database tables, RLS policies, auth profile trigger and tracking RPC
- `_headers` — basic browser security headers for Cloudflare Pages
