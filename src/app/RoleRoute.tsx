import { Navigate, Outlet } from "react-router-dom";
import useAppSelector from "../hooks/useAppSelector";
import type { UserRole } from "../types";
import LoadingSpinner from "../components/ui/LoadingSpinner";

interface RoleRouteProps {
  allow: UserRole[];
  redirectTo?: string;
}

/**
 * RoleRoute — gates a route by role.
 *
 * Rules:
 * - While auth status is "loading" → show spinner
 * - company_owner always passes through (they are the super admin)
 * - company_admin passes through for management routes
 * - staff is restricted to their assigned warehouse
 */
const RoleRoute = ({ allow, redirectTo = "/dashboard" }: RoleRouteProps) => {
  const user       = useAppSelector((s) => s.auth.user);
  const profile    = useAppSelector((s) => s.auth.profile);
  const authStatus = useAppSelector((s) => s.auth.status);

  // Wait for the authoritative profile role
  const role = (profile?.role as UserRole | undefined) ?? (user?.role as UserRole | undefined);

  if (!role && authStatus === "loading") {
    return <LoadingSpinner />;
  }

  // No role resolved yet — wait
  if (!role && authStatus === "idle") {
    return <LoadingSpinner />;
  }

  const effectiveRole = role ?? "staff";

  // Allow if role is in the allow list
  const permitted = allow.includes(effectiveRole);

  return permitted
    ? <Outlet />
    : <Navigate to={redirectTo} replace />;
};

export default RoleRoute;