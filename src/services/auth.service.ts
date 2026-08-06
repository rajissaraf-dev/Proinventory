// src/services/auth.service.ts
/**
 * auth.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles Firebase Auth operations and the global users/{uid} Firestore doc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  GoogleAuthProvider,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth } from "./firebase";
import db from "./firebase";
import {
  UserProfile,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS,
} from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email:       string;
  password:    string;
  fullName:    string;
  companyId:   string;
  role?:       UserRole;
  permissions?: UserPermissions;
}

export interface AuthResult {
  user:    User;
  profile: UserProfile;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a full UserProfile document for users/{uid} */
const buildUserProfile = (
  uid:       string,
  email:     string,
  fullName:  string,
  companyId: string,
  role:      UserRole      = "company_owner",
  permissions?: UserPermissions,
): UserProfile => ({
  uid,
  email,
  displayName:  fullName,
  companyId,
  role,
  status:       "active",
  permissions:  permissions ?? DEFAULT_PERMISSIONS[role],
  assignedWarehouseId: "",
  createdAt:    new Date(),
  updatedAt:    new Date(),
});

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const AuthService = {

  /**
   * Register a new user with email + password.
   * Writes users/{uid} after Firebase Auth account is created.
   */
  async register(input: RegisterInput): Promise<AuthResult> {
    const { user } = await createUserWithEmailAndPassword(
      auth, input.email, input.password
    );

    const profile = buildUserProfile(
      user.uid,
      input.email,
      input.fullName,
      input.companyId,
      input.role ?? "company_owner",
      input.permissions,
    );

    await setDoc(doc(db, "users", user.uid), profile);
    console.log("✅ [AuthService.register] users/{uid} written:", profile);

    return { user, profile };
  },

  /**
   * Sign in with email + password.
   * Fetches users/{uid} profile from Firestore.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const profile  = await AuthService.getProfile(user.uid);
    return { user, profile };
  },

  /**
   * Sign in with Google OAuth.
   * Creates users/{uid} on first login.
   */
  async signInWithGoogle(companyId = ""): Promise<AuthResult> {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());

    // Check if profile already exists
    const existing = await AuthService.getProfile(user.uid).catch(() => null);
    if (existing) return { user, profile: existing };

    // First Google login — write users/{uid}
    const profile = buildUserProfile(
      user.uid,
      user.email ?? "",
      user.displayName ?? "User",
      companyId,
      "company_owner",
    );
    await setDoc(doc(db, "users", user.uid), profile);
    console.log("✅ [AuthService.signInWithGoogle] users/{uid} written:", profile);

    return { user, profile };
  },

  /**
   * Fetch users/{uid} profile.
   * Returns null if document does not exist.
   */
  async getProfile(uid: string): Promise<UserProfile> {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) throw new Error(`No profile found for uid: ${uid}`);
    return { ...snap.data(), uid: snap.id } as UserProfile;
  },

  /**
   * Update safe fields on users/{uid}.
   */
  async updateProfile(
    uid:     string,
    updates: Partial<Pick<UserProfile, "displayName" | "updatedAt">>,
  ): Promise<void> {
    await updateDoc(doc(db, "users", uid), { ...updates, updatedAt: new Date() });
  },

  /** Send a password reset email. */
  async sendPasswordReset(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email);
  },

  /** Sign out the current user. */
  async signOut(): Promise<void> {
    await signOut(auth);
  },
};