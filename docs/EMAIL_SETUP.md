# Email setup: custom SMTP for Supabase (do this before user testing on 19 October)

HustleHub signs people in with a **6-digit code sent by email**. Out of the box Supabase sends those emails from a shared
address with a very low limit, and it only delivers to people who are members of your Supabase organisation. That is fine
for the team and **not enough for students**. You need your own SMTP provider.

This guide covers **Resend** and **Brevo** so you can pick one. Allow **2 to 3 working days** for DNS and approvals, so
start by about **10 October**.

---

## 0. Decide first (10 minutes)

| | **Resend** | **Brevo** |
|---|---|---|
| Needs a domain you control | **Yes**, to send to anyone | **No** to start (verify one sender address), but a domain is strongly recommended |
| Setup time | Fast once DNS is added | Fast, but new accounts are sometimes manually reviewed first |
| Free allowance (check their pricing page, it changes) | about 100 emails a day | about 300 emails a day |
| Good for | Clean developer experience, clear logs | When you cannot touch DNS in time |
| Watch out for | Cannot send from `@gmail.com` or `@vossie.net` unless you own the domain; the shared test sender only reaches *your own* address | Sending **from a Gmail address** gets rejected or lands in spam (Gmail's DMARC policy) |

**Which email address will it send from?** This is the real decision.
- `vossie.net` and `eduvos.com` belong to Eduvos. To send as `no-reply@vossie.net` Eduvos IT must add DNS records (steps below). Ask them early.
- If IT cannot help in time, register a cheap domain you control (for example a `.co.za` or `.com` for about R100 to R200 a year) such as `vossie-market.co.za`, and send from `no-reply@that-domain`. Students will receive it fine; the *sign-in* still only accepts `@vossie.net` and `@eduvos.com` addresses.
- Do **not** send from a personal Gmail address.

**Recommendation:** use **Resend** if you (or Eduvos IT) can add DNS records this week; otherwise use **Brevo** with a verified sender and add domain authentication when you can.

---

## 1. Option A: Resend

### 1.1 Create the account and verify your domain
1. Go to <https://resend.com> and sign up.
2. **Domains > Add Domain**. Enter your domain (for example `vossie-market.co.za`). Choose the region closest to your users (a European region is fine for South Africa).
3. Resend shows DNS records to add at the domain's DNS host (Eduvos IT, or your registrar's DNS page):
   - an **SPF** record (type `TXT`, host usually `send`), 
   - a **DKIM** record (type `TXT`, host usually `resend._domainkey`),
   - an **MX** record for bounce handling (host `send`),
   - optionally a **DMARC** record (type `TXT`, host `_dmarc`, value `v=DMARC1; p=none;`).
   Copy them **exactly**. If your DNS host appends the domain automatically, enter only the part before your domain.
4. Click **Verify DNS Records**. This can take minutes to a few hours. Wait for **Verified**.

### 1.2 Create an API key
1. **API Keys > Create API Key**, name it `vossie-supabase-smtp`, permission **Sending access**, and limit it to your domain.
2. Copy the key (it starts with `re_`). You see it **once**. Store it in your password manager. **Never put it in the repo or `.env.example`.**

### 1.3 SMTP details to give Supabase
| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` (SSL). `587` also works if 465 is blocked |
| Username | `resend` |
| Password | your `re_...` API key |
| Sender email | `no-reply@your-domain` (must be on the verified domain) |
| Sender name | `HustleHub` |

---

## 2. Option B: Brevo

### 2.1 Create the account and a sender
1. Go to <https://www.brevo.com> and sign up. New accounts may be asked to describe their use and can wait for approval, so do this first.
2. **Senders, Domains & Dedicated IPs > Senders > Add a sender**. Enter the name `HustleHub` and an address **on a domain you control** (for example `no-reply@vossie-market.co.za`). Brevo emails a confirmation link to that address. You must be able to receive mail there, so set up a forward or mailbox first.
3. Strongly recommended: **Domains > Add a domain**, then add the **Brevo code (TXT)**, **DKIM (two CNAME or TXT records)** and a **DMARC (TXT)** record it shows. Click **Authenticate**. This stops your sign-in codes landing in junk.

### 2.2 Get your SMTP key
1. Top right account menu, **SMTP & API > SMTP** tab.
2. Note the **Login** (an address ending in `@smtp-brevo.com`). Click **Generate a new SMTP key**, name it `vossie-supabase`, and copy the key. You see it **once**. Keep it out of the repo.

### 2.3 SMTP details to give Supabase
| Field | Value |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` (STARTTLS) |
| Username | the **Login** shown on the SMTP tab |
| Password | the **SMTP key** you generated (not your account password) |
| Sender email | the verified sender address |
| Sender name | `HustleHub` |

---

## 3. Connect it to Supabase (both options)

1. Open the Supabase dashboard for project **`vxqgcaznbwhwgvauupby`**.
2. **Authentication > Emails > SMTP Settings** (older dashboards: **Project Settings > Auth > SMTP Settings**).
3. Switch on **Enable custom SMTP**.
4. Fill in **Sender email**, **Sender name**, **Host**, **Port**, **Username**, **Password** from section 1.3 or 2.3.
5. Set **Minimum interval between emails** to about `30` seconds (the default is 60, which feels slow for sign-in).
6. **Save**.
7. **Authentication > Rate Limits**: raise **Rate limit for sending emails** to something your provider allows (for example 60 an hour while testing). The default for custom SMTP is low.

### The sign-in email must contain the code
HustleHub signs in with the 6-digit code, not a link.
1. **Authentication > Emails > Templates**. Open **Magic Link** (and **Confirm signup**, used the first time someone signs in).
2. Make sure the body contains `{{ .Token }}`. A simple template:

```html
<h2>Your HustleHub sign-in code</h2>
<p>Enter this code in HustleHub:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px">{{ .Token }}</p>
<p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
```

3. Set the subject to something recognisable, such as `Your HustleHub sign-in code`.

---

## 4. Test it (15 minutes)

1. Start the app and go to `/login`. Enter your own `@vossie.net` or `@eduvos.com` address (it must be allow-listed: Admin > Manage > Allowed email domains).
2. The code should arrive in under a minute. Check **Junk**.
3. If it doesn't: Supabase dashboard **Logs > Auth** shows the SMTP error; your provider's dashboard (Resend **Emails** or Brevo **Transactional > Logs**) shows whether it was sent, bounced or blocked.
4. Send to **three different mailboxes** (a `vossie.net` student address, an `eduvos.com` staff address and a Gmail address) and note where each lands.
5. Optional: send one to <https://www.mail-tester.com> and aim for 9/10 or better.

### Common problems
| Symptom | Likely cause and fix |
|---|---|
| `535 Authentication failed` | Wrong username or password. Resend username is literally `resend`; Brevo username is the `@smtp-brevo.com` login and the password is the SMTP key. |
| "Sender not verified" / `550` | The sender address or domain isn't verified yet. Finish DNS verification or the sender confirmation email. |
| Code arrives but in Junk | Add SPF, DKIM and DMARC (steps above). Ask Eduvos IT to allow-list the sender domain in their Microsoft 365 or Google tenant. |
| Nothing arrives, no error | Check the Supabase **minimum interval** and **rate limit**, and the allow-list (sign-up is blocked for other domains by design). |
| `Connection timed out` | Try the other port (465 vs 587). |
| Email says "Confirm your signup" with a link, not a code | The template is missing `{{ .Token }}`. Edit **Confirm signup** too. |

---

## 5. Before 19 October checklist

- [ ] Decision made: Resend or Brevo, and the sending domain
- [ ] DNS records added and verified (or sender confirmed)
- [ ] API key or SMTP key saved in the password manager (not in git)
- [ ] Custom SMTP enabled in Supabase and saved
- [ ] Templates contain `{{ .Token }}` and a clear subject
- [ ] Email rate limit raised for testing
- [ ] Test codes received at `vossie.net`, `eduvos.com` and Gmail
- [ ] Eduvos IT asked to allow-list the sender domain
- [ ] A teammate has signed in from a fresh browser using only the emailed code
- [ ] **Leaked password protection** switched on (Authentication > Providers > Email), a one-click item the Supabase advisor flags

## 6. After that (Phase 6)

New-enquiry emails and the daily digest are already queued in the `email_queue` table, with no sender attached on purpose.
When you choose a provider, a small Edge Function can read that table and send through the same provider. Keep the API key
in **Supabase secrets** (`supabase secrets set RESEND_API_KEY=...` or `BREVO_API_KEY=...`), never in the repository.
