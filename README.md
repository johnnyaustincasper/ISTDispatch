# IST Dispatch — Deployment Guide

## STEP 1: Set Up Firebase (Free Database)

This is what lets the office and field crews share data in real-time.

1. Go to **https://console.firebase.google.com**
2. Click **"Create a project"** → name it `ist-dispatch` → click through (disable Google Analytics if you want, you don't need it)
3. Once the project is created, click the **web icon** `</>` on the project overview page to add a web app
4. Name it `ist-dispatch` → click **Register app**
5. You'll see a code block with your Firebase config — **copy these values**, you'll need them:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
6. Click **Continue to console**

### Enable Firestore Database

7. In the left sidebar, click **"Build"** → **"Firestore Database"**
8. Click **"Create database"**
9. Select **"Start in test mode"** (this allows read/write for 30 days — we'll lock it down later)
10. Choose your region (us-central1 is fine) → click **Enable**

✅ Firebase is ready.

---

## STEP 2: Push Code to GitHub

1. Go to **https://github.com/new** and create a new repo called `ist-dispatch` (private is fine)
2. On your computer, unzip the project folder, open a terminal in that folder, and run:

```bash
git init
git add .
git commit -m "IST Dispatch app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ist-dispatch.git
git push -u origin main
```

---

## STEP 3: Deploy to Vercel

1. Go to **https://vercel.com** and log in with your GitHub account
2. Click **"Add New..."** → **"Project"**
3. Find and select your `ist-dispatch` repository
4. Under **Framework Preset**, it should auto-detect **Vite** — if not, select it
5. Expand **"Environment Variables"** and add these 6 variables using the values from Step 1:

| Variable Name | Value |
|---|---|
| `VITE_FB_API_KEY` | your apiKey |
| `VITE_FB_AUTH_DOMAIN` | your authDomain |
| `VITE_FB_PROJECT_ID` | your projectId |
| `VITE_FB_STORAGE_BUCKET` | your storageBucket |
| `VITE_FB_MESSAGING_ID` | your messagingSenderId |
| `VITE_FB_APP_ID` | your appId |

6. Click **Deploy**
7. Wait ~60 seconds and you'll get your live URL like `ist-dispatch.vercel.app`

✅ App is live!

---

## STEP 4: Lock Down Firebase (Important — Do After 30 Days or Now)

Go back to Firebase Console → Firestore → **Rules** tab, and replace the rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

This keeps it open for your crews. For tighter security later, we can add authentication.

---

## How to Use

### Office (You / Salesmen)
1. Open the app URL → click **OFFICE**
2. Go to **Trucks** tab → add your trucks (Truck 1, Truck 2, Foam Rig, etc.)
3. Go to **Schedule** tab → **+ Add Job** with address, builder, type, and assign to a truck
4. Watch the **Live Feed** tab for real-time crew updates

### Field Crews
1. Open the same app URL on their phone → click **FIELD CREW**
2. Enter their name and select their truck
3. They see today's jobs assigned to their truck
4. At end of day (or anytime), tap **Send Update** → set status, ETA, and notes

All updates show up instantly on the office side — no refresh needed.
