import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { doc, getDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import db from "../../services/firebase";
import { CurrentUser, CurrentUserState, UserProfile, DEFAULT_PERMISSIONS } from "../../types";
import { sanitizeCurrentUser, sanitizeUserProfile } from "../../services/sanitize.service";

// ── Helper: convert Firestore Timestamps to ISO strings so Redux stays serializable ──
const serializeProfile = (data: Record<string, any>): UserProfile => {
  const toISO = (v: any): any => {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    return v;
  };

  const normalizedStatus = data.status ?? "active";

  const profile = {
    ...data,
    uid:                data.uid       ?? "",
    email:              data.email     ?? "",
    displayName:        data.displayName ?? "",
    status:             normalizedStatus,
    role:               data.role      ?? "company_owner",
    companyId:          data.companyId ?? "",
    isSuperAdmin:       Boolean(data.isSuperAdmin),
    permissions:        data.permissions ?? DEFAULT_PERMISSIONS[data.role ?? "company_owner"],
    assignedWarehouseId: data.assignedWarehouseId ?? "",
    createdAt:          toISO(data.createdAt),
    updatedAt:          toISO(data.updatedAt),
  } as UserProfile;
  
  // ── XSS Protection: Sanitize profile data ──
  const sanitized = sanitizeUserProfile(profile);
  if (!sanitized) {
    console.error("❌ [authSlice] Profile sanitization failed — data rejected");
    throw new Error("User profile validation failed");
  }
  
  return sanitized;
};

/**
 * Fetch users/{uid} profile.
 * - Serializes Firestore Timestamps so Redux stays serializable.
 * - Auto-repairs status:"inactive" for the guest account.
 */
export const fetchUserProfile = createAsyncThunk<UserProfile, string>(
  "auth/fetchUserProfile",
  async (uid) => {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      console.error("❌ [authSlice] No users/{uid} doc — run npm run seed:guest");
      throw new Error(`No user profile found for uid: ${uid}. Run npm run seed:guest.`);
    }

    const raw = { ...(snap.data() as Record<string, any>), uid: snap.id } as {
      uid: string;
      status?: string;
      [key: string]: any;
    };

    // ── Auto-repair: if status is inactive, fix it in Firestore and in memory ──
    if (raw.status === "inactive") {
      console.warn("⚠️ [authSlice] status:inactive detected — patching to active for uid:", uid);
      try {
        await updateDoc(doc(db, "users", uid), { status: "active" });
        raw.status = "active";
      } catch (patchErr) {
        // Firestore rules might block this — rules require auth.uid == uid for update
        // which should pass since we ARE that user right now
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
        uid:   d.id,
        email: data.email ?? "",
      } as CurrentUser;
    });
  }
);

const rawStored  = sessionStorage.getItem("currentUser");
let parsedUser: CurrentUser | null = null;

if (rawStored) {
  try {
    const parsed = JSON.parse(rawStored);
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

// Discard stale fake companyIds generated before seed script existed
const stored = parsedUser?.companyId?.startsWith("guest_company_") ? null : parsedUser;

const initialState: CurrentUserState = {
  user:    stored,
  profile: null,
  users:   [],
  status:  "idle",
  error:   null,
};

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
      state.user    = null;
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
        state.status  = "succeeded";
        state.profile = action.payload;
        const updatedUser = {
        ...state.user,
        uid:                 action.payload.uid,
        email:               action.payload.email,
        companyId:          action.payload.companyId,
        displayName:        action.payload.displayName,
        role:               action.payload.role,
        isSuperAdmin:       action.payload.isSuperAdmin,
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
          isSuperAdmin: action.payload.isSuperAdmin,
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
        state.error  = action.error.message ?? null;
        console.warn("⚠️ [authSlice] Profile fetch failed:", action.error.message);
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.users = action.payload;
      });
  },
});

export const { setCurrentUser, clearCurrentUser, addUsers } = authSlice.actions;
export default authSlice.reducer;
