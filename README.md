# EventApp

A campus event discovery and registration app. Students browse events, like
them and register without an account. Organisers sign in with email and
password to post events, upload posters, design the registration form for each
event, and download registrations as a spreadsheet.

- **Front end:** React + Vite, mobile-first, single 480px column
- **Database, auth and file storage:** Supabase
- **Hosting:** Cloudflare Workers (static assets)

---

## How the pieces fit

```
Browser  ──►  Cloudflare Worker        serves the built React app
   │
   └──────►  Supabase
              ├─ Postgres      events, registrations, likes, admins
              ├─ Auth          email + password, organisers only
              └─ Storage       poster images in a public bucket
```

There is no server code of your own. The browser talks to Supabase directly,
and row level security decides who may read or write what.

**One registration per person** is enforced in three places, and only the last
one really counts:

1. The Register button turns into "You're registered" using a pass saved in the
   browser.
2. The form checks the email against the database before submitting, so the
   message is friendly.
3. A unique index on `(event_id, lower(email))` in Postgres. Clearing browser
   data does not get past this.

---

## 1. Install the project locally

You need Node 18 or newer.

```bash
git clone https://github.com/YOUR-USERNAME/eventapp.git
cd eventapp
npm install
```

---

## 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a project, and pick a
   region close to you (Singapore or Mumbai for India).
2. Save the database password somewhere. You will not need it for this app, but
   losing it is annoying later.
3. Wait for the project to finish provisioning, about two minutes.

### Run the schema

Open **SQL Editor → New query**, paste the entire contents of
`supabase/schema.sql`, and press **Run**. It creates every table, index,
function, policy and the storage bucket in one go.

### Create your organiser account

1. **Authentication → Users → Add user → Create new user.**
   Enter your email and a password, and tick **Auto confirm user**.
2. Copy the new user's **UID**.
3. Back in the SQL editor, run this with your own values:

   ```sql
   insert into admins (id, email, org_name)
   values ('PASTE-UID-HERE', 'you@campus.ac.in', 'Students'' Council')
   on conflict (id) do update set org_name = excluded.org_name;
   ```

   Note the doubled apostrophe in `Students'' Council` — that is how you escape
   a quote inside SQL.

4. **Authentication → Sign In / Providers →** turn **off** "Allow new users to
   sign up". Without this, anyone could create an account. They still would not
   be an admin (no row in `admins`), but there is no reason to allow it.

Repeat steps 1–3 for each club or department that needs to post events.

### Copy your API keys

**Project Settings → API.** You need two values:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a long string starting with `eyJ`

The anon key is meant to be public and ships inside the JavaScript bundle. It is
safe because row level security controls what it can do. Never use the
`service_role` key in this project.

---

## 3. Run it locally

Create a file named `.env.local` in the project root:

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Then:

```bash
npm run dev
```

Open http://localhost:5173. The Discover tab will be empty. Go to **Admin**,
sign in with the account you created, and post your first event.

If you see the "Almost there" screen, the two variables are missing or
misspelled. Restart `npm run dev` after editing `.env.local` — Vite only reads
it at startup.

---

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "EventApp"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/eventapp.git
git push -u origin main
```

`.env.local` is in `.gitignore` and will not be committed. That is deliberate —
you will add the same two values to Cloudflare in the next step.

---

## 5. Deploy to Cloudflare Workers

`wrangler.jsonc` is already configured to serve the `dist` folder as a
single-page app, so any URL falls back to `index.html`.

### The quick way, from your machine

```bash
npx wrangler login      # opens a browser to authorise
npm run deploy          # builds, then uploads
```

Your site goes live at `https://eventapp.YOUR-SUBDOMAIN.workers.dev`.

### The better way, from GitHub

This redeploys automatically on every push.

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository.**
2. Pick your `eventapp` repo and authorise Cloudflare to read it.
3. Set:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - **Root directory:** `/`
4. Under **Build variables**, add both:

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |

5. **Save and deploy.**

**This is the step people get wrong:** Vite bakes `VITE_*` variables into the
bundle at *build* time, not at runtime. They must be **build variables**, and
after changing one you have to trigger a fresh build. A redeploy of the old
build will not pick it up.

### Custom domain

Worker → **Settings → Domains & Routes → Add → Custom domain.** Point it at a
domain already on Cloudflare DNS and the certificate is issued for you.

Then in Supabase, **Authentication → URL Configuration**, set **Site URL** to
your live address. Email and password sign-in works without this, but you will
need it the day you add password resets.

---

## 6. Check it works

Open the live site on your phone:

- [ ] Events show on Discover with posters and seat counts
- [ ] The heart fills and survives a reload
- [ ] Registering gives you a pass with a code
- [ ] Reopening that event shows "You're registered", not a Register button
- [ ] Registering again with the same email is refused
- [ ] Admin sign-in works, and posting an event makes it appear on Discover
- [ ] A poster upload appears on the card within a second or two
- [ ] Registrations tab downloads a CSV that opens in Excel

---

## Using the admin side

**Posting an event** takes two steps. *Event details* covers the poster, name,
date, venue, seats, fee, rules and policies. *Registration form* is where you
decide what to ask.

**The form builder.** Every event starts with five questions: name, email,
mobile, roll number and department. Add your own with **Add a question** —
short text, paragraph, email, mobile, number, dropdown, yes/no, or date. Each
one can be reordered, renamed, made optional, given a placeholder and a helper
note. Dropdowns take one choice per line.

Name and email carry a padlock and cannot be removed. The name prints on the
pass, and the email is what makes the duplicate check work. You can still
reword either question.

Change a form after people have registered and nothing breaks. Old rows keep
their old answers; the new column simply appears empty for them.

**Posters.** Upload from your phone and the image is resized to about 1400px
before it reaches storage, so a 5MB photo lands as roughly 200KB. Skip the
upload and the event prints its own poster in the colours of its category.

**Registrations.** Pick an event, look at the rows, download the CSV. Columns
follow that event's own form.

---

## Project layout

```
eventapp/
├── index.html
├── wrangler.jsonc          Cloudflare Worker config (static assets, SPA)
├── vite.config.js
├── supabase/schema.sql     the entire database, run once
├── public/
│   ├── favicon.svg
│   └── manifest.webmanifest
└── src/
    ├── main.jsx            entry point
    ├── App.jsx             discover, event detail, registration, passes
    ├── Admin.jsx           sign-in, event editor, form builder, exports
    ├── ui.jsx              logo, posters, fields, form builder
    ├── styles.css
    └── lib/
        ├── api.js          every Supabase call lives here
        └── helpers.js      dates, validation, form model, CSV
```

Want to change something? `lib/api.js` is the only file that talks to the
database. `lib/helpers.js` holds the form field types and the default form.
Colours are CSS variables at the top of `styles.css`.

---

## Common problems

**"Almost there" screen on the live site.** The build variables were missing at
build time. Add them and trigger a new build.

**"Couldn't reach the database".** Usually the URL has a typo or a trailing
slash. It should end in `.supabase.co` with nothing after it.

**Sign-in says the password doesn't match.** The user exists but was never
confirmed. In Supabase, open the user and confirm them, or delete and recreate
with **Auto confirm user** ticked.

**Sign-in works but posting an event fails.** There is no row in `admins` for
that user's UID. Run the insert from step 2.

**Poster upload fails.** Same cause — uploads are restricted to admins. Check
the `admins` row before anything else.

**Events save but students see nothing.** Check `published` is true on the row,
and that you ran the whole schema file including the policies at the bottom.

---

## What is deliberately not here

- **Payments.** The fee is displayed, not collected. Add Razorpay or Stripe
  between the form and `register_for_event` when you need it.
- **Real QR codes.** The pass shows a code grid generated from the pass code —
  fine for a human reading it at the gate. For scanning, add a QR library and
  encode the same `code` value.
- **Email confirmations.** Supabase can send them, but it needs an SMTP
  provider configured. The pass in the app is the record for now.
