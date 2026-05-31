# CoachFit — Project Guide for Claude

A 1:1 fitness coaching web app. Two roles chosen at signup — **coach** and **client** — with
distinct layouts. Coaches manage many clients from a dashboard and a per-client deep dive;
clients track their own nutrition, weight, photos, and message their coach.

## Stack

- **Next.js 16** (App Router) + **TypeScript**, **Tailwind v4**
- **Firebase**: Auth (email/password), Firestore (data), Storage (progress photos)
- **Recharts** for progress charts
- **Anthropic Claude SDK** (server-side only) for AI Insights, the **AI food estimator**, and **AI-drafted check-in replies**
- **Resend** for transactional email (client invites)
- **Stripe** for billing (WIP — see Roadmap)

**🔴 LIVE in production at https://mycoachfit.xyz** (Vercel project `coaching`, GitHub `stonelarson2/coachapp`, Firebase `coaching-app-177c0`). Deploy with `vercel --prod --yes`. Push to `main` is the source of truth.

## Run

```powershell
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also typechecks)
npm run lint       # eslint
```

⚠️ The app needs real credentials before it works end-to-end. Copy `.env.example` →
`.env.local` and fill in Firebase + Anthropic values. **Full instructions are in `SETUP.md`.**

## Architecture & conventions

- **Auth state**: `src/context/AuthContext.tsx` exposes `useAuth()` → `{ user, profile, loading, signup, login, logout }`. `profile` is the realtime Firestore `users/{uid}` doc.
- **Routing**: marketing/login/signup/onboarding are top-level routes. The authed app lives under the `src/app/(app)` route group, guarded by `src/components/Guard.tsx` and wrapped in `src/components/AppShell.tsx` (role-aware sidebar). Coach home = `/dashboard`; client home = `/me`; coach views a client at `/clients/[id]`.
- **Firebase is lazy**: never import a live `auth`/`db` instance at module scope. Use the getters in `src/lib/firebase/client.ts` (`getFirebaseAuth`, `getDb`, `getStorageInstance`) and `src/lib/firebase/admin.ts` (`getAdminAuth`, `getAdminDb`). This keeps SSR/`next build` from initializing Firebase. **Keep it this way.**
- **Data layer**: all client-side Firestore access (realtime hooks + write helpers) lives in `src/lib/data.ts` (`useClients`, `useUserDoc`, `useWeightEntries`, `useFoodLog`, `usePhotos`, `useMessages`, `useInsights`, `useCheckins`, plus `logWeight`, `addFoodLog`, `importFoodLogs`, `uploadPhoto`, `sendMessage`, `submitCheckin`, `replyToCheckin`, `updateUserFields`, …). Add new data access here.
- **Per-client workspace**: `src/components/client/ClientWorkspace.tsx` renders the tabbed UI shared by coach and client views. Tabs are in `src/components/client/tabs/`. Shared context (`target`, `viewerId`, `viewerRole`, `isCoachView`, `unit`) via `src/components/client/context.tsx` → `useWorkspace()`.
- **Nutrition math**: `src/lib/nutrition.ts` — Mifflin-St Jeor BMR → TDEE → maintain/cut/bulk targets and macro auto-calc. Tuning constants are exported there.
- **Units**: weight is stored in **kg**; display unit (`lb` default) is per-user. Convert with helpers in `src/lib/units.ts`. Dates are ISO `YYYY-MM-DD` local-time strings.
- **Server routes** (`src/app/api/*`): `onboarding` (validates coach password / invite code, assigns role via Admin SDK), `insights` (aggregates data, calls Claude, persists), `clients` (coach-only; Admin SDK creates a client auth account + linked `users` doc, **auto-generates a password and emails the invite via Resend**; `mode:"example"` seeds a demo client), `food-estimate` (any signed-in user; Claude **vision + forced tool use** → structured macros from a food photo or text description), and `checkin-draft` (coach-only; Claude drafts a reply to a client's weekly check-in). Use `src/lib/server-auth.ts#verifyRequest` to verify the bearer ID token. Call them from the client with `src/lib/api.ts#authedFetch`.
- **AI patterns**: server routes use `process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6"` (vision-capable). For reliable structured JSON, use **forced tool use** (`tool_choice: {type:"tool"}`) — see `food-estimate/route.ts`. Never parse macros out of prose.
- **Email**: `src/lib/email.ts` (`sendClientInviteEmail`) wraps Resend; no-ops if `RESEND_API_KEY` is unset. Sends from `noreply@mycoachfit.xyz` (domain verified in Resend via Porkbun DNS).
- **Other lib helpers added**: `src/lib/mfpImport.ts` (parse MyFitnessPal CSV), `src/lib/image.ts` (client-side canvas downscaling for photo uploads), `src/lib/billing.ts` (Stripe plan catalog), `src/lib/stripe/server.ts` (lazy Stripe client).
- **Name handling**: the signup name must flow into the profile. The onboarding page sends `user.displayName` in the `/api/onboarding` body (the ID token's `decoded.name` is stale right after signup, so don't rely on it); the route falls back to the Admin SDK's `getUser().displayName` before ever defaulting to `"Unnamed"`. Users can edit their own name in **Settings** (`NameEditor` → `updateUserFields(uid, { name })`).
- **UI kit**: lightweight Tailwind primitives in `src/components/ui.tsx` (`Button`, `Card`, `Input`, `Select`, `Stat`, `Badge`, `Spinner`, …). Prefer these over new component libraries.
- **Theming (light/dark)**: `src/context/ThemeContext.tsx` exposes `useTheme()` → `{ theme: 'light'|'dark'|'system', resolved, setTheme }` (localStorage-persisted; anti-flash inline script in `src/app/layout.tsx`). Colors are **semantic CSS tokens** in `src/app/globals.css`: use `bg-surface`, `bg-elevated`, `text-primary-soft-fg`, etc., and Tailwind's gray scale (which is remapped under `.dark`). Cards/inputs use `bg-surface`; modals use `bg-elevated`. Prefer these tokens over hardcoded `bg-white`/`text-gray-*` colors so new UI themes automatically. Recharts charts read `resolved` for axis/grid/tooltip colors (see `ProgressTab.tsx#chartTheme`).

## Security

- Coach signup password lives in `.env.local` as `COACH_SIGNUP_PASSWORD` — server-validated, **never** sent to the browser, **never** commit the real value (`.env.example` uses a placeholder).
- Firestore/Storage rules (`firestore.rules`, `storage.rules`): a client reads/writes only their own data; a coach reads/writes only clients where `client.coachId == coach.uid`. Profile docs and insights are written via the Admin SDK. Deploy with `firebase deploy --only firestore:rules,storage` and indexes from `firestore.indexes.json`.
- Privileged fields (`role`, `coachId`, `inviteCode`) are only set server-side.

## Data model (Firestore)

`users/{uid}` (role, profile, goal, calorieTarget, macroTargets, meeting, start/currentWeightKg, inviteCode/coachId, **`billing`**) ·
`weightEntries` · `foodLogs` · `photos` · `messages` · `insights` · **`checkins`** (weekly: `weekOf` Monday ISO, `weightKg`, `ratings` six 1-5 self-scores, `notes`, `coachReply`). Types in `src/lib/types.ts`. Check-ins query needs the composite index in `firestore.indexes.json` (`userId` + `weekOf desc`).

## Project skills

Installed under `.claude/skills/` (project-local; load on a fresh Claude Code session).
Both were added via `npx claude-code-templates@latest --skill <path>` from aitmpl.com (a
third-party community source) and include Python helper scripts.

- **`senior-frontend`** — frontend dev toolkit for React/Next.js/TypeScript/Tailwind:
  component scaffolding, bundle analysis, performance optimization, and UI best-practice
  references. Use when building/refactoring frontend features or reviewing frontend code.
- **`ui-design-system`** — design-system toolkit: design token generation (colors,
  typography, spacing), responsive calculations, accessibility, and dev-handoff docs.
  Use when establishing visual consistency or generating design tokens.

## Current setup status (LIVE)

- **Hosting**: deployed on **Vercel** (project `coaching`, team `stonelarson2s-projects`) at
  **https://mycoachfit.xyz** (domain on Porkbun, A record `@`→`76.76.21.21`). GitHub remote
  `stonelarson2/coachapp` (`main`). `vercel` CLI installed + logged in. Redeploy: `vercel --prod --yes`.
- **Env vars**: all `.env.local` vars are mirrored as Vercel **production** env vars (Firebase
  client+admin, `ANTHROPIC_API_KEY`/`MODEL`, `COACH_SIGNUP_PASSWORD`=`Wideopen2007!!`,
  `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL=https://mycoachfit.xyz`).
- **Firebase** `coaching-app-177c0` (owner `stonelarson19@gmail.com`): Firestore + `firestore.rules`
  + indexes **deployed**. `mycoachfit.xyz` is in Auth → Authorized domains.
- **Resend**: domain `mycoachfit.xyz` verified (DKIM/SPF in Porkbun). Invite emails work.
- ⚠️ **Firebase Storage still NOT enabled** (Build → Storage → Get started). Progress-photo
  uploads and check-in photos fail until enabled, then `firebase deploy --only storage`.
- ⚠️ Service-account private key was pasted into chat during setup — consider **rotating it**.

### ‼️ Gotcha — setting Vercel env vars on Windows
Piping a value into `vercel env add` via PowerShell prepends a **UTF-8 BOM** (`%EF%BB%BF`) that
silently corrupts the value (this caused `auth/network-request-failed` on the Firebase API key).
**Fix:** set env vars from a Node script using `execSync("vercel env add NAME production --force", {input: value})`, never a PowerShell pipe.

## Roadmap / pending work

**Done this session:** ✅ deployed to Vercel + custom domain · ✅ MyFitnessPal CSV import
(`src/lib/mfpImport.ts` + Food Log tab) · ✅ Resend invite emails · ✅ AI food estimator ·
✅ light/dark theme · ✅ mobile polish · ✅ **weekly check-ins** (Check-ins tab: client form
with weight + six 1-5 ratings + notes; coach review with **AI-drafted replies**).

1. **Stripe billing — PAUSED mid-build.** 3 plans: **3-month $600, 6-month $1000, 1-year $1800**
   (upfront), or monthly installments over the term at **+10% premium**. Stripe account
   **"Stone Coaching"** (`acct_1TNfIO6divSS0hm8`) connected (also via Stripe MCP tools).
   Building/testing in **Stripe TEST mode first**, then flip to live. **Scaffolding committed**:
   `src/lib/stripe/server.ts`, `src/lib/billing.ts` (plan catalog, price IDs come from env vars
   `NEXT_PUBLIC_STRIPE_PRICE_*`), `Billing` type + `billing` field on `UserDoc`. **To resume:**
   get user's `sk_test_...` key → provision 6 test prices (upfront+installment ×3) → build
   `/api/stripe/checkout` (Checkout Session) + `/api/stripe/webhook` (update `users/{uid}.billing`)
   + Billing UI (coach sends a checkout link; status badge) → test with card `4242 4242 4242 4242`.
2. **Reminders & PWA.** Email nudges (via Resend) to log food / weigh in; make the app installable
   (manifest + service worker).
3. **Enable Firebase Storage** to unblock progress photos (incl. attaching photos to check-ins).

> The user does **training/workout programming in a separate app** — do NOT build workout/exercise
> features here.

## Environment note

`H:\coaching` required an explicit NTFS Modify grant for the user (the Claude session runs
non-elevated). If writes fail with `EPERM`, run in an elevated shell:
`icacls "H:\coaching" /grant "Stone Larson:(OI)(CI)M" /T`.
