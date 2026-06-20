import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the Firebase service account credentials.
// - Local dev: read config/serviceAccount.json (gitignored).
// - Deployment: set FIREBASE_SERVICE_ACCOUNT to the raw JSON string (no file needed).
let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const filePath = path.join(__dirname, "serviceAccount.json");
  serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// Guard against re-initializing on hot reload (nodemon).
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

export const adminAuth = getAuth();
