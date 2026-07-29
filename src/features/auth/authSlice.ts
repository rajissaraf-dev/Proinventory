import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { doc, getDoc, updateDoc, collection, getDocs, DocumentData } from "firebase/firestore";
import db from "../../services/firebase";
import { CurrentUser, CurrentUserState, UserProfile, DEFAULT_PERMISSIONS } from "../../types";
import { sanitizeCurrentUser, sanitizeUserProfile } from "../../services/sanitize.service";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Firestore document data with possible Timestamp fields */
type FirestoreUserData = DocumentData & {
  uid?: string;
  status?: string;
  role?: string;
  companyId?: string;
  email?: string;
  displayName?: string;
  permissions?: Record<string, boolean>;
  assignedWarehouseId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown; // For any additional fields
};

/** Raw user data from Firestore with known fields */
interface RawUserData {
  uid: string;
  status?: string;
  role?: string;
  companyId?: string;
  email?: string;
  displayName?: string;
  permissions?: Record<string, boolean>;
  assignedWarehouseId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

// ─── Helper: Convert Firestore Timestamps to ISO strings ──────────────────

/**
 * Converts a Firestore Timestamp or Date to ISO string
 * Returns null for falsy values
 */
const toISOString = (value: unknown): string | null => {
  if (!value) return null;
  
  // Check if it's a Firestore Timestamp (has toDate method)
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  
  // Check if it's a Date object
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // If it's already a string, return it
  if (typeof value === "string") {
    return value;
  }
  
  // Return null for other types
  return null;
};

/**
 * Serializes Firestore data to a UserProfile with ISO date strings
 */
const serializeProfile = (data: FirestoreUserData): UserProfile => {
  const normalizedStatus = data.status ?? "active";
  
  // Get role with fallback
  const role = data.role ?? "company_owner";
  
  // Build the profile object
  const profile = {
    uid: data.uid ?? "",
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    status: normalizedStatus as "active" | "inactive",
    role: role as "company_owner" | "company_admin" | "staff",
    companyId: data.companyId ?? "",
    permissions: data.permissions ?? DEFAULT_PERMISSIONS[role as keyof typeof DEFAULT_PERMISSIONS] ?? DEFAULT_PERMISSIONS.company_owner,
    assignedWarehouseId: data.assignedWarehouseId ?? "",
    createdAt: toISOString(data.createdAt),
    updatedAt: toISOString(data.updatedAt),
  } as UserProfile;
  
  // ── XSS Protection: Sanitize profile data ──
  const sanitized = sanitizeUserProfile(profile);
  if (!sanitized) {
    console.error("❌ [authSlice] Profile sanitization failed — data rejected");
    throw new Error("User profile validation failed");
  }
  
  return sanitized;
};

// ─── Async Thunks ────────────────────────────────────────────────────────────

/**
 * Fetch users/{uid} profile.
 * - Serializes Firestore Timestamps so Redux stays serializable.
 * - Auto-repairs status:"inactive" to "active".
 */
export const fetchUserProfile = createAsyncThunk<UserProfile, string>(
  "auth/fetchUserProfile",
  async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.error("❌ [authSlice] No users/{uid} doc");
      throw new Error(`No user profile found for uid: ${uid}.`);
    }

    const data = snap.data() as FirestoreUserData;
    const raw: RawUserData = {
      uid: snap.id,
      status: data.status,
      role: data.role,
      companyId: data.companyId,
      email: data.email,
      displayName: data.displayName,
      permissions: data.permissions,
      assignedWarehouseId: data.assignedWarehouseId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    // ── Auto-repair: if status is inactive, fix it in Firestore and in memory ──
    if (raw.status === "inactive") {
      console.warn("⚠️ [authSlice] status:inactive detected — patching to active for uid:", uid);
      try {
        await updateDoc(doc(db, "users", uid), { status: "active" });
        raw.status = "active";
      } catch (patchErr) {
        console.error("❌ [authSlice] Could not patch status:", patchErr);
      }
    }

    const profile = serializeProfile(raw);
    console.log("✅ [authSlice] users/{uid} profile fetched:", profile);
    return profile;
  }
);

export const fetchUsers = createAsyncThunk<CurrentUser[]>(
  "auth/fetchUsers",
  async () => {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        email: (data.email as string) ?? "",
      };
    });
  }
);

// ─── Session Storage Recovery ──────────────────────────────────────────────

const rawStored = sessionStorage.getItem("currentUser");
let parsedUser: CurrentUser | null = null;

if (rawStored) {
  try {
    const parsed = JSON.parse(rawStored) as Record<string, unknown>;
    // ── XSS Protection: Sanitize stored user data ──
    parsedUser = sanitizeCurrentUser(parsed);
    if (!parsedUser) {
      console.warn("⚠️ [authSlice] Stored user data failed sanitization — clearing");
      sessionStorage.removeItem("currentUser");
    }
  } catch (err) {
    console.error("❌ [authSlice] Failed to parse stored user:", err);
    sessionStorage.removeItem("currentUser");
  }
}

// ── REMOVED: Guest company ID detection ──
const stored = parsedUser;

// ─── Initial State ──────────────────────────────────────────────────────────

const initialState: CurrentUserState = {
  user: stored,
  profile: null,
  users: [],
  status: "idle",
  error: null,
};

// ─── Slice ──────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCurrentUser(state, action: PayloadAction<CurrentUser>) {
      // ── XSS Protection: Sanitize before storing ──
      const sanitized = sanitizeCurrentUser(action.payload);
      if (!sanitized) {
        console.error("❌ [authSlice] User data failed sanitization — not stored");
        return;
      }
      state.user = sanitized;
      sessionStorage.setItem("currentUser", JSON.stringify(sanitized));
    },
    clearCurrentUser(state) {
      state.user = null;
      state.profile = null;
      sessionStorage.removeItem("currentUser");
      console.log("🔓 [authSlice] Session cleared.");
    },
    addUsers(state, action: PayloadAction<CurrentUser[]>) {
      state.users = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.profile = action.payload;
        
        const updatedUser = {
          ...state.user,
          uid: action.payload.uid,
          email: action.payload.email,
          companyId: action.payload.companyId,
          displayName: action.payload.displayName,
          role: action.payload.role,
          assignedWarehouseId: action.payload.assignedWarehouseId,
        };

        // ── XSS Protection: Sanitize before storing ──
        const sanitized = sanitizeCurrentUser(updatedUser);
        if (sanitized) {
          state.user = sanitized;
          sessionStorage.setItem("currentUser", JSON.stringify(sanitized));
        } else {
          // If stored user is missing partial auth state, build from profile
          const fallbackUser = {
            uid: action.payload.uid,
            email: action.payload.email,
            companyId: action.payload.companyId,
            displayName: action.payload.displayName,
            role: action.payload.role,
            assignedWarehouseId: action.payload.assignedWarehouseId,
          };
          const fallbackSanitized = sanitizeCurrentUser(fallbackUser);
          if (fallbackSanitized) {
            state.user = fallbackSanitized;
            sessionStorage.setItem("currentUser", JSON.stringify(fallbackSanitized));
          }
        }
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? null;
        console.warn("⚠️ [authSlice] Profile fetch failed:", action.error.message);
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.users = action.payload;
      });
  },
});

export const { setCurrentUser, clearCurrentUser, addUsers } = authSlice.actions;
export default authSlice.reducer;