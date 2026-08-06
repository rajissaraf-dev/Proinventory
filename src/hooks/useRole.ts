// src/hooks/useRole.ts
import useAppSelector from "./useAppSelector";
import type { UserRole, UserPermissions, ModulePermission } from "../types";

/**
 * useRole — central role/permission helper hook.
 *
 * Usage:
 *   const { isOwner, isAdmin, canWrite, canDelete } = useRole();
 */
const useRole = () => {
  const user = useAppSelector((s) => s.auth.user);
  const profile = useAppSelector((s) => s.auth.profile);

  // ─── Get role from profile or user ───
  const role: UserRole | null =
    (profile?.role as UserRole | undefined) ??
    (user?.role as UserRole | undefined) ??
    null;
  
  const perms = profile?.permissions;
  const assignedWarehouseId = profile?.assignedWarehouseId ?? user?.assignedWarehouseId ?? "";

  /* ─── Role booleans ─── */
  const isOwner = role === "company_owner";
  const isAdmin = role === "company_admin";
  const isStaff = role === "staff";
  const isOwnerOrAdmin = isOwner || isAdmin;
  // hasWarehouseScope: true when the user is locked to a specific warehouse
  // Applies to staff with an assignment, AND admins with an assignment
  const hasWarehouseScope = (isStaff || isAdmin) && !!assignedWarehouseId;

  /* ─── Permission helpers ─── */
  type PermissionModule = keyof UserPermissions;

  /**
   * Check if a module has a specific permission
   * Handles the different module shapes (some have only 'read', others have full ModulePermission)
   */
  const hasPermission = (mod: PermissionModule, action: "read" | "write" | "delete"): boolean => {
    // Owners have all permissions
    if (isOwner) return true;
    
    // Admins have all permissions except delete (handled separately)
    if (isAdmin && action !== "delete") return true;
    
    // Staff need explicit permissions
    if (isStaff && perms) {
      const modulePerms = perms[mod];
      if (!modulePerms) return false;
      
      // Handle the module permission safely
      if (action === "read") {
        return Boolean(modulePerms.read);
      }
      if (action === "write") {
        // Check if write exists on the module (some modules like dashboard don't have write)
        return Boolean((modulePerms as ModulePermission)?.write ?? false);
      }
      if (action === "delete") {
        return Boolean((modulePerms as ModulePermission)?.delete ?? false);
      }
    }
    
    return false;
  };

  const canRead = (mod: PermissionModule): boolean => {
    return hasPermission(mod, "read");
  };

  const canWrite = (mod: PermissionModule): boolean => {
    return hasPermission(mod, "write");
  };

  const canDelete = (mod: PermissionModule): boolean => {
    return hasPermission(mod, "delete");
  };

  /* ─── Product-specific shortcuts ─── */
  const canAddProduct = canWrite("products");
  const canEditProduct = isOwner || isAdmin;
  const canDeleteProduct = isOwner;
  const canManageUsers = isOwner || isAdmin;
  const canViewReports = isOwner || isAdmin;
  const canManageSettings = isOwner;

  return {
    role,
    isOwner,
    isAdmin,
    isStaff,
    isOwnerOrAdmin,
    canRead,
    canWrite,
    canDelete,
    canAddProduct,
    canEditProduct,
    canDeleteProduct,
    canManageUsers,
    canViewReports,
    canManageSettings,
    assignedWarehouseId,
    hasWarehouseScope,
    user,
    profile,
  };
};

export default useRole;