/**
 * sanitize.service.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * XSS Protection: Sanitize user input and stored data using DOMPurify
 * ─────────────────────────────────────────────────────────────────────────────
 */

import DOMPurify from "dompurify";
import { CurrentUser, UserProfile } from "../types";

// ─── Config ──────────────────────────────────────────────────────────────────
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [], // No HTML tags allowed for user data
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

// ─── Sanitize String ─────────────────────────────────────────────────────────
/**
 * Sanitize a single string to prevent XSS attacks
 */
const sanitizeString = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return DOMPurify.sanitize(value, PURIFY_CONFIG);
};

// ─── Validate & Sanitize CurrentUser ────────────────────────────────────────
/**
 * Whitelist validation + sanitization for CurrentUser objects
 * Prevents malicious JSON injection from localStorage/sessionStorage
 */
export const sanitizeCurrentUser = (data: unknown): CurrentUser | null => {
  if (!data || typeof data !== "object") {
    console.warn("⚠️ [sanitize] Invalid user data type:", typeof data);
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Validate uid (Firebase UID format: 28 chars alphanumeric)
  const uid = sanitizeString(obj.uid);
  if (!uid || uid.length < 5 || uid.length > 256) {
    console.warn("⚠️ [sanitize] Invalid uid length:", uid?.length);
    return null;
  }

  // Validate email
  const email = sanitizeString(obj.email);
  if (!email || email.length < 3 || !email.includes("@")) {
    console.warn("⚠️ [sanitize] Invalid email format:", email);
    return null;
  }

  // Validate companyId (can be various lengths, even "platform")
  const companyId = obj.companyId !== undefined ? sanitizeString(obj.companyId) : "";
  if (companyId && (companyId.length < 2 || companyId.length > 256)) {
    console.warn("⚠️ [sanitize] Invalid companyId:", companyId);
    return null;
  }

  // ── UPDATED: Valid roles (removed guest and super_admin) ──
  const validRoles = [
    "company_owner",
    "company_admin",
    "staff",
  ];
  const role = obj.role;
  if (role !== undefined && !validRoles.includes(role as string)) {
    console.warn("⚠️ [sanitize] Invalid role:", role);
    return null;
  }

  // Validate displayName if provided
  const displayName = obj.displayName !== undefined ? sanitizeString(obj.displayName) : "";
  if (displayName && displayName.length > 512) {
    console.warn("⚠️ [sanitize] Display name too long");
    return null;
  }

  // ── REMOVED: isSuperAdmin validation ──
  // (owner is the super admin, so this field is no longer needed)

  // Validate assignedWarehouseId (optional, but sanitize if present)
  const assignedWarehouseId = sanitizeString(obj.assignedWarehouseId || "");

  return {
    uid,
    email,
    companyId: companyId || undefined,
    role: role !== undefined ? (role as CurrentUser["role"]) : undefined,
    displayName: displayName || undefined,
    // ── REMOVED: isSuperAdmin ──
    assignedWarehouseId: assignedWarehouseId || undefined,
  } as CurrentUser;
};

// ─── Validate & Sanitize UserProfile ────────────────────────────────────────
/**
 * Sanitize UserProfile objects fetched from Firestore
 * Prevents stored XSS if Firestore data is compromised
 */
export const sanitizeUserProfile = (data: unknown): UserProfile | null => {
  if (!data || typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;

  // Use CurrentUser sanitization for base fields
  // ── REMOVED: isSuperAdmin from the sanitizeCurrentUser call ──
  const currentUser = sanitizeCurrentUser({
    uid: obj.uid,
    email: obj.email,
    companyId: obj.companyId,
    role: obj.role,
    displayName: obj.displayName,
    // isSuperAdmin: obj.isSuperAdmin, ← REMOVED
    assignedWarehouseId: obj.assignedWarehouseId,
  });

  if (!currentUser) return null;

  // Add UserProfile-specific fields
  return {
    ...currentUser,
    status: ["active", "inactive"].includes(obj.status as string)
      ? (obj.status as "active" | "inactive")
      : "active",
    permissions: obj.permissions || {},
    // ── REMOVED: isSuperAdmin ──
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : null,
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : null,
  } as UserProfile;
};

// ─── Sanitize HTML Display Text ──────────────────────────────────────────────
/**
 * Sanitize text that will be displayed as HTML
 * Use when rendering user-generated content or untrusted data
 */
export const sanitizeDisplayText = (text: unknown): string => {
  const sanitized = sanitizeString(text);
  // Truncate to prevent overflow attacks
  return sanitized.slice(0, 1000);
};

export const SanitizeService = {
  sanitizeCurrentUser,
  sanitizeUserProfile,
  sanitizeDisplayText,
  sanitizeString,
};