# CoachFit — Project Guide for Claude

A 1:1 fitness coaching web app. Two roles chosen at signup — **coach** and **client** — with
distinct layouts. Coaches manage many clients from a dashboard and a per-client deep dive;
clients track their own nutrition, weight, photos, and message their coach.

## Stack

- **Next.js 16** (App Router) + **TypeScript**, **Tailwind v4**
- **Firebase**: Auth (email/password), Firestore (data), Storage (progress photos)
- **Recharts** for progress charts
- **Anthropic Claude SDK** for the Insight tab (server-side only)

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
- **Data layer**: all client-side Firestore access (realtime hooks + write helpers) lives in `src/lib/data.ts` (`useClients`, `useUserDoc`, `useWeightEntries`, `useFoodLog`, `usePhotos`, `useMessages`, `useInsights`, plus `logWeight`, `addFoodLog`, `uploadPhoto`, `sendMessage`, `updateUserFields`, …). Add new data access here.
- **Per-client workspace**: `src/components/client/ClientWorkspace.tsx` renders the tabbed UI shared by coach and client views. Tabs are in `src/components/client/tabs/`. Shared context (`target`, `viewerId`, `viewerRole`, `isCoachView`, `unit`) via `src/components/client/context.tsx` → `useWorkspace()`.
- **Nutrition math**: `src/lib/nutrition.ts` — Mifflin-St Jeor BMR → TDEE → maintain/cut/bulk targets and macro auto-calc. Tuning constants are exported there.
- **Units**: weight is stored in **kg**; display unit (`lb` default) is per-user. Convert with helpers in `src/lib/units.ts`. Dates are ISO `YYYY-MM-DD` local-time strings.
- **Server routes**: `src/app/api/onboarding/route.ts` (validates coach password / invite code, assigns role via Admin SDK), `src/app/api/insights/route.ts` (aggregates data, calls Claude, persists), and `src/app/api/clients/route.ts` (coach-only; Admin SDK creates a client auth account + linked `users` doc. `mode:"example"` seeds a demo client with weigh-ins + food logs). Use `src/lib/server-auth.ts#verifyRequest` to verify the bearer ID token. Call them from the client with `src/lib/api.ts#authedFetch`.
- **UI kit**: lightweight Tailwind primitives in `src/components/ui.tsx` (`Button`, `Card`, `Input`, `Select`, `Stat`, `Badge`, `Spinner`, …). Prefer these over new component libraries.
- **Theming (light/dark)**: `src/context/ThemeContext.tsx` exposes `useTheme()` → `{ theme: 'light'|'dark'|'system', resolved, setTheme }` (localStorage-persisted; anti-flash inline script in `src/app/layout.tsx`). Colors are **semantic CSS tokens** in `src/app/globals.css`: use `bg-surface`, `bg-elevated`, `text-primary-soft-fg`, etc., and Tailwind's gray scale (which is remapped under `.dark`). Cards/inputs use `bg-surface`; modals use `bg-elevated`. Prefer these tokens over hardcoded `bg-white`/`text-gray-*` colors so new UI themes automatically. Recharts charts read `resolved` for axis/grid/tooltip colors (see `ProgressTab.tsx#chartTheme`).

## Security

- Coach signup password lives in `.env.local` as `COACH_SIGNUP_PASSWORD` — server-validated, **never** sent to the browser, **never** commit the real value (`.env.example` uses a placeholder).
- Firestore/Storage rules (`firestore.rules`, `storage.rules`): a client reads/writes only their own data; a coach reads/writes only clients where `client.coachId == coach.uid`. Profile docs and insights are written via the Admin SDK. Deploy with `firebase deploy --only firestore:rules,storage` and indexes from `firestore.indexes.json`.
- Privileged fields (`role`, `coachId`, `inviteCode`) are only set server-side.

## Data model (Firestore)

`users/{uid}` (role, profile, goal, calorieTarget, macroTargets, meeting, start/currentWeightKg, inviteCode/coachId) ·
`weightEntries` · `foodLogs` · `photos` · `messages` · `insights`. Types in `src/lib/types.ts`.

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

## Current setup status (live Firebase)

The app is wired to a **real Firebase project: `coaching-app-177c0`** (owner Google
account `stonelarson19@gmail.com`). Local secrets are in `.env.local` (git-ignored):
Firebase client + admin creds and an Anthropic key are all set; `COACH_SIGNUP_PASSWORD`
is `Wideopen2007!!`.

- Firebase CLI is installed and logged in. `firebase.json` / `.firebaserc` are committed.
- **Firestore** database + `firestore.rules` + indexes are **deployed**.
- ⚠️ **Storage is NOT enabled yet** in the Firebase console (Build → Storage → Get
  started). Until then, progress-photo uploads fail and `firebase deploy ... storage`
  errors. Enabling it + `firebase deploy --only storage` is an open task.
- ⚠️ The service-account private key was pasted into chat during setup — consider
  **rotating it** (Project settings → Service accounts) before going to production.

## Roadmap / pending work

1. **24/7 hosting so clients can use it.** Not deployed yet; **no git remote**, and
   `gh`/`vercel` CLIs are not installed. Recommended path: push to GitHub → deploy on
   **Vercel** (best fit for Next.js 16 SSR + API routes). Must replicate all `.env.local`
   vars as Vercel env vars, and add the production domain to Firebase Auth → Authorized
   domains. (Vercel Hobby is non-commercial; a real coaching business needs Pro.)
2. **MyFitnessPal food import.** MFP has **no public API** anymore, so live sync isn't
   viable. Planned approach: let clients upload their **MFP "Export Data" CSV** and parse
   it into `foodLogs` (map Date→date, Meal→meal, Food→name, Calories/Protein/Carbs/Fat→
   macros). Build as a new write helper in `src/lib/data.ts` + an import UI on the Food
   Log tab.

## Environment note

`H:\coaching` required an explicit NTFS Modify grant for the user (the Claude session runs
non-elevated). If writes fail with `EPERM`, run in an elevated shell:
`icacls "H:\coaching" /grant "Stone Larson:(OI)(CI)M" /T`.
