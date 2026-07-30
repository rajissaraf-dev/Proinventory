/**
 * useCompanyAccess
 * ─────────────────────────────────────────────────────────────────────────────
 * Access tiers:
 *   loading     → company doc not yet in Redux — show spinner, grant access
 *   trial       → full access for 30 days
 *   active      → full access (paid subscriber)
 *   suspended   → upgrade prompt
 * ─────────────────────────────────────────────────────────────────────────────
 */

import useAppSelector from "./useAppSelector";
import useRole from "./useRole";

export interface CompanyAccess {
  hasAccess: boolean;
  isLoading: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  daysLeft: number | null;
  isTrial: boolean;
  isSubscribed: boolean;
  isGuest: boolean;
  subscriptionStatus: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const FULL_ACCESS: Omit<CompanyAccess, "isGuest" | "isLoading"> = {
  hasAccess: true,
  isExpired: false,
  isSuspended: false,
  daysLeft: null,
  isTrial: false,
  isSubscribed: true,
  subscriptionStatus: "active",
};

const useCompanyAccess = (): CompanyAccess => {
  const company = useAppSelector((s) => s.company.company);
  const authStatus = useAppSelector((s) => s.auth.status);
  const { isOwner, isAdmin } = useRole();

  // ─── Owner/Admin — always full access ───
  if (isOwner || isAdmin) {
    return { ...FULL_ACCESS, isLoading: false, isGuest: false };
  }

  // Auth profile still loading — show spinner but grant access optimistically
  if (authStatus === "loading" || authStatus === "idle") {
    return {
      hasAccess: true,
      isLoading: true,
      isExpired: false,
      isSuspended: false,
      daysLeft: 30,
      isTrial: true,
      isSubscribed: false,
      isGuest: false,
      subscriptionStatus: "trialing",
    };
  }

  // Profile loaded but company doc not in Redux yet
  if (!company) {
    return {
      hasAccess: true,
      isLoading: false,
      isExpired: false,
      isSuspended: false,
      daysLeft: 30,
      isTrial: true,
      isSubscribed: false,
      isGuest: false,
      subscriptionStatus: "trialing",
    };
  }

  // ─── Evaluate real company data ───
  const status = company.status ?? "trial";
  const subscriptionStatus = company.subscriptionStatus ?? "trialing";
  const trialEndsAt = company.trialEndsAt;

  // Subscribed = explicitly paid (not just status active from seeding)
  const isSubscribed =
    (status === "active" && subscriptionStatus === "active") ||
    subscriptionStatus === "active";

  // If subscribed: full access, no trial needed
  if (isSubscribed) {
    return {
      hasAccess: true,
      isLoading: false,
      isExpired: false,
      isSuspended: false,
      daysLeft: null,
      isTrial: false,
      isSubscribed: true,
      isGuest: false,
      subscriptionStatus,
    };
  }

  const isTrial = status === "trial" || subscriptionStatus === "trialing";
  const endTime = trialEndsAt
    ? new Date(trialEndsAt).getTime()
    : Date.now() + THIRTY_DAYS_MS;

  const msLeft = endTime - Date.now();
  const daysLeft = isTrial ? Math.max(0, Math.ceil(msLeft / 86_400_000)) : null;
  const isExpired = isTrial && msLeft <= 0;

  const isSuspended = status === "suspended" || subscriptionStatus === "past_due";
  const hasAccess = isTrial && !isExpired;

  return {
    hasAccess,
    isLoading: false,
    isExpired,
    isSuspended,
    daysLeft,
    isTrial,
    isSubscribed,
    isGuest: false,
    subscriptionStatus,
  };
};

export default useCompanyAccess;