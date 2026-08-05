/**
 * scripts/seed-owner.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates the owner account and the default Main Warehouse.
 * The default warehouse is created ALWAYS, even before any products or staff.
 * 
 * Run once after setting owner credentials in .env:
 *   npm run seed:owner
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, "../.env");
const envVars = {};

try {
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['\"]|['\"]$/g, "");
    envVars[key] = value;
  }
} catch {
  console.error("❌ Could not read .env file.");
  process.exit(1);
}

const REQUIRED = [
  "VITE_FIREBASE_KEY",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_OWNER_EMAIL",
  "VITE_OWNER_PASSWORD",
  "VITE_OWNER_NAME",
  "VITE_OWNER_COMPANY_NAME",
];

const missing = REQUIRED.filter((key) => !envVars[key]);
if (missing.length > 0) {
  console.error("❌ Missing required env vars:", missing.join(", "));
  process.exit(1);
}

const {
  VITE_FIREBASE_KEY: apiKey,
  VITE_FIREBASE_PROJECT_ID: projectId,
  VITE_OWNER_EMAIL: ownerEmail,
  VITE_OWNER_PASSWORD: ownerPassword,
  VITE_OWNER_NAME: ownerName,
  VITE_OWNER_COMPANY_NAME: ownerCompanyName,
} = envVars;

// ─── Default Permissions ────────────────────────────────────────────────

const DEFAULT_PERMISSIONS = {
  company_owner: {
    dashboard: { read: true },
    products: { read: true, write: true, delete: true },
    categories: { read: true, write: true, delete: true },
    orders: { read: true, write: true, delete: true },
    purchaseOrders: { read: true, write: true, delete: true },
    stock: { read: true, write: true, delete: true, adjust: true },
    suppliers: { read: true, write: true, delete: true },
    customers: { read: true, write: true, delete: true },
    reports: { read: true, write: true, delete: true },
    settings: { read: true, write: true, delete: true },
    users: { read: true, write: true, delete: true },
    sales: { read: true, write: true, delete: true },
    notifications: { read: true, write: true },
  },
  company_admin: {
    dashboard: { read: true },
    products: { read: true, write: true },
    categories: { read: true, write: true },
    orders: { read: true, write: true },
    purchaseOrders: { read: true, write: true },
    stock: { read: true, write: true },
    suppliers: { read: true, write: true },
    customers: { read: true, write: true },
    reports: { read: true },
    settings: { read: true },
    users: { read: true },
    sales: { read: true, write: true },
    notifications: { read: true, write: true },
  },
  staff: {
    dashboard: { read: true },
    products: { read: true },
    categories: { read: true },
    orders: { read: true },
    purchaseOrders: { read: true },
    stock: { read: true },
    suppliers: { read: true },
    customers: { read: true },
    reports: { read: true },
    settings: { read: true },
    users: { read: true },
    sales: { read: true, write: true },
    notifications: { read: true },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate company ID */
const generateCompanyId = (name, uid) => {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 24);
  return `cmp_${slug}_${uid.slice(0, 6)}`;
};

/** Convert JS objects to Firestore format */
function toFirestoreValue(value) {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(v => toFirestoreValue(v)) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

/** Write to Firestore using REST API with auth token */
async function writeDocument(path, data, idToken) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
  
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify({ fields }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to write ${path}: ${error}`);
  }
  
  return response.json();
}

/** Create user in Firebase Auth and get ID token */
async function createUser() {
  console.log("\n📧  Creating Firebase Auth account...");
  
  if (ownerPassword.length < 6) {
    console.error("❌  Password must be at least 6 characters long.");
    process.exit(1);
  }
  
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: ownerEmail,
        password: ownerPassword,
        returnSecureToken: true,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to create user');
  }
  
  const data = await response.json();
  console.log(`✅  User created: ${data.localId}`);
  
  return { uid: data.localId, idToken: data.idToken };
}

/** Check if user exists */
async function checkUserExists() {
  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ownerEmail,
          password: ownerPassword,
          returnSecureToken: true,
        }),
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      return { exists: true, uid: data.localId, idToken: data.idToken };
    }
    
    const error = await response.json();
    if (error.error?.message === 'EMAIL_NOT_FOUND' || error.error?.message === 'INVALID_LOGIN_CREDENTIALS') {
      return { exists: false };
    }
    
    throw new Error(error.error?.message || 'Failed to check user');
  } catch (err) {
    return { exists: false };
  }
}

// ─── Document Builders ──────────────────────────────────────────────────────

/** Build user profile with default warehouse assigned */
const buildUserProfile = (uid, companyId, timestamp) => ({
  uid,
  email: ownerEmail,
  displayName: ownerName,
  companyId,
  role: "company_owner",
  status: "active",
  permissions: DEFAULT_PERMISSIONS.company_owner,
  assignedWarehouseId: "main_warehouse",
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** Build company - ACTIVE (no trial) */
const buildCompany = (companyId, ownerId, timestamp) => ({
  name: ownerCompanyName,
  slug: companyId,
  email: ownerEmail,
  phone: "",
  industry: "",
  plan: "starter",
  status: "active",
  subscriptionStatus: "active",
  ownerId,
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** Build company user with default warehouse assigned */
const buildCompanyUser = (uid, companyId, timestamp) => ({
  uid,
  email: ownerEmail,
  displayName: ownerName,
  companyId,
  role: "company_owner",
  status: "active",
  permissions: DEFAULT_PERMISSIONS.company_owner,
  assignedWarehouseId: "main_warehouse",
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** Build DEFAULT WAREHOUSE */
const buildWarehouse = (companyId, ownerId, timestamp) => ({
  name: "Main Warehouse",
  code: "WH-001",
  address: "",
  city: "",
  country: "",
  isDefault: true,
  companyId,
  createdBy: ownerId,
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** Build settings general */
const buildSettingsGeneral = (companyId, timestamp) => ({
  companyName: ownerCompanyName,
  currency: "USD",
  timezone: "UTC",
  lowStockAlert: 10,
  updatedAt: timestamp,
});

/** Build settings roles */
const buildSettingsRoles = (timestamp) => ({
  roles: {
    company_owner: {
      displayName: "Owner",
      permissions: DEFAULT_PERMISSIONS.company_owner,
    },
    company_admin: {
      displayName: "Admin",
      permissions: DEFAULT_PERMISSIONS.company_admin,
    },
    staff: {
      displayName: "Staff",
      permissions: DEFAULT_PERMISSIONS.staff,
    },
  },
  updatedAt: timestamp,
});

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱  ProInventory — Owner Seed Script");
  console.log("─".repeat(52));
  console.log(`   Project : ${projectId}`);
  console.log(`   Email   : ${ownerEmail}`);
  console.log(`   Company : ${ownerCompanyName}`);
  console.log("─".repeat(52));

  let uid, idToken;
  
  // Check if user exists
  console.log("\n🔍  Checking if user exists...");
  const userCheck = await checkUserExists();
  
  if (userCheck.exists) {
    console.log(`⚠️  User already exists: ${userCheck.uid}`);
    uid = userCheck.uid;
    idToken = userCheck.idToken;
    
    console.log("\n💡  This will overwrite existing Firestore data.");
    console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    const result = await createUser();
    uid = result.uid;
    idToken = result.idToken;
  }

  const companyId = generateCompanyId(ownerCompanyName, uid);
  const warehouseId = "main_warehouse";
  const timestamp = new Date();

  // Build all documents
  const userProfile = buildUserProfile(uid, companyId, timestamp);
  const companyData = buildCompany(companyId, uid, timestamp);
  const companyUserData = buildCompanyUser(uid, companyId, timestamp);
  const warehouseData = buildWarehouse(companyId, uid, timestamp);
  const settingsGeneralData = buildSettingsGeneral(companyId, timestamp);
  const settingsRolesData = buildSettingsRoles(timestamp);

  console.log(`\n📝  Writing Firestore documents...`);
  console.log(`   User UID: ${uid}`);
  console.log(`   Company ID: ${companyId}`);
  console.log(`   Warehouse ID: ${warehouseId} (DEFAULT)`);

  try {
    // ─── CRITICAL: Write user profile FIRST so security rules recognize the user ───
    // 1. users/{uid} (MUST be first!)
    await writeDocument(`users/${uid}`, userProfile, idToken);
    console.log(`   ✅ 1/6 users/${uid}`);

    // 2. companies/{companyId}
    await writeDocument(`companies/${companyId}`, companyData, idToken);
    console.log(`   ✅ 2/6 companies/${companyId}`);

    // 3. companies/{companyId}/users/{uid}
    await writeDocument(`companies/${companyId}/users/${uid}`, companyUserData, idToken);
    console.log(`   ✅ 3/6 companies/${companyId}/users/${uid}`);

    // 4. ✅ DEFAULT WAREHOUSE - Now the user exists, so this should work!
    await writeDocument(`companies/${companyId}/warehouses/${warehouseId}`, warehouseData, idToken);
    console.log(`   ✅ 4/6 companies/${companyId}/warehouses/${warehouseId} (DEFAULT)`);

    // 5. companies/{companyId}/settings/general
    await writeDocument(`companies/${companyId}/settings/general`, settingsGeneralData, idToken);
    console.log(`   ✅ 5/6 companies/${companyId}/settings/general`);

    // 6. companies/{companyId}/settings/roles
    await writeDocument(`companies/${companyId}/settings/roles`, settingsRolesData, idToken);
    console.log(`   ✅ 6/6 companies/${companyId}/settings/roles`);

    console.log("\n🎉  Owner seeded successfully!");
    console.log("────────────────────────────────────────────────────");
    console.log(`   Email   : ${ownerEmail}`);
    console.log(`   Password: ${ownerPassword}`);
    console.log(`   Company : ${ownerCompanyName}`);
    console.log(`   Company ID: ${companyId}`);
    console.log(`   User UID: ${uid}`);
    console.log(`   ✅ DEFAULT WAREHOUSE: ${warehouseId} (Main Warehouse)`);
    console.log("────────────────────────────────────────────────────");
    console.log("\n🔐  You can now log in at: http://localhost:5173/login");
    console.log(`   Email: ${ownerEmail}`);
    console.log(`   Password: ${ownerPassword}`);
    console.log("\n📦  Default warehouse is ready. Add products when you're ready!");
    
    process.exit(0);
  } catch (err) {
    console.error("\n❌  Failed to write documents:", err.message);
    console.log("\n💡  Troubleshooting:");
    console.log("   1. Make sure you're connected to the internet");
    console.log("   2. Check that Firebase project is properly configured");
    console.log("   3. Verify the ID token is valid");
    console.log("   4. Check Firestore security rules");
    process.exit(1);
  }
}

seed().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});