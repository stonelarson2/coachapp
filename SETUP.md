# CoachFit — Setup Guide

This app is a Next.js + Firebase web app for 1:1 fitness coaching. It needs a
Firebase project (for login, database, and photo storage) and an Anthropic API
key (for the AI Insight tab). Follow these steps once.

## 1. Install dependencies

```powershell
npm install
```

## 2. Create a Firebase project

1. Go to https://console.firebase.google.com and click **Add project**.
2. Once created, in the left sidebar open **Build**:
   - **Authentication** → Get started → enable **Email/Password**.
   - **Firestore Database** → Create database → start in **production mode** (we ship rules).
   - **Storage** → Get started.

## 3. Get the client (browser) config

1. Firebase console → **Project settings** (gear icon) → **General**.
2. Under *Your apps*, click the **Web** icon (`</>`) and register an app.
3. Copy the `firebaseConfig` values into `.env.local`:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `storageBucket` → `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` → `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` → `NEXT_PUBLIC_FIREBASE_APP_ID`

## 4. Get the Admin (server) credentials

1. **Project settings** → **Service accounts** → **Generate new private key**.
2. From the downloaded JSON, copy into `.env.local`:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the `\n` sequences, wrap in double quotes)

## 5. Anthropic (Claude) API key

1. Get a key at https://console.anthropic.com.
2. Put it in `.env.local` as `ANTHROPIC_API_KEY`.

## 6. Deploy the security rules

Install the Firebase CLI and deploy the rules in this repo
(`firestore.rules`, `storage.rules`):

```powershell
npm install -g firebase-tools
firebase login
firebase use --add        # pick your project
firebase deploy --only firestore:rules,storage
```

(Alternatively, paste the contents of `firestore.rules` / `storage.rules` into the
console's Rules tabs.)

## 7. Coach signup password

The coach signup gate password lives in `.env.local` as `COACH_SIGNUP_PASSWORD`.
Set it to whatever you want there — it is never sent to the browser and never
committed to git. Change it any time.

## 8. Run

```powershell
npm run dev
```

Open http://localhost:3000. Sign up as a coach (using the coach password) to get
your invite code, then sign up clients with that code.
