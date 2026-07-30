// src/types/index.ts
import { ReactNode } from "react";

// ─── Firebase / Firestore ────────────────────────────────────────────────────

export interface FirebaseTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

// ─── Role & Plan enums ───────────────────────────────────────────────────────

// ── UPDATED: Only 3 roles (removed super_admin and guest) ──
export type UserRole =
  | "company_owner"     // business owner — full access to own company
  | "company_admin"     // delegated admin inside a company
  | "staff";            // can view + add products, cannot delete/update

export type SubscriptionPlan = "starter" | "most_popular" | "enterprise";

export type UserStatus = "active" | "inactive" | "suspended";

// ─── Granular module permissions ─────────────────────────────────────────────

export interface ModulePermission {
  read:   boolean;
  write:  boolean;
  delete: boolean;
}

export interface UserPermissions {
  dashboard:      { read: boolean };
  products:       ModulePermission;
  categories:     ModulePermission;
  orders:         ModulePermission;
  purchaseOrders: ModulePermission;
  stock:          ModulePermission & { adjust: boolean };
  suppliers:      ModulePermission;
  customers:      ModulePermission;
  reports:        ModulePermission;
  settings:       ModulePermission;
  users:          ModulePermission;
  sales: { read: boolean; write: boolean; delete: boolean };
}

/** Default permissions per role */
// ── UPDATED: Only 3 roles ──
export const DEFAULT_PERMISSIONS: Record<UserRole, UserPermissions> = {
  company_owner: {
    dashboard:      { read: true },
    products:       { read: true, write: true, delete: true },
    categories:     { read: true, write: true, delete: true },
    orders:         { read: true, write: true, delete: true },
    purchaseOrders: { read: true, write: true, delete: true },
    stock:          { read: true, write: true, delete: true, adjust: true },
    suppliers:      { read: true, write: true, delete: true },
    customers:      { read: true, write: true, delete: true },
    reports:        { read: true, write: true, delete: false },
    settings:       { read: true, write: true, delete: false },
    users:          { read: true, write: true, delete: true },
    sales:          { read: true, write: true, delete: false },
  },
  company_admin: {
    dashboard:      { read: true },
    products:       { read: true, write: true, delete: false },
    categories:     { read: true, write: true, delete: false },
    orders:         { read: true, write: true, delete: false },
    purchaseOrders: { read: true, write: true, delete: false },
    stock:          { read: true, write: true, delete: false, adjust: true },
    suppliers:      { read: true, write: false, delete: false },
    customers:      { read: true, write: true, delete: false },
    reports:        { read: true, write: false, delete: false },
    settings:       { read: true, write: false, delete: false },
    users:          { read: true, write: true, delete: false },
    sales:          { read: true, write: true, delete: false },
  },
  staff: {
    dashboard:      { read: true },
    products:       { read: true, write: true, delete: false },
    categories:     { read: true, write: false, delete: false },
    orders:         { read: true, write: false, delete: false },
    purchaseOrders: { read: false, write: false, delete: false },
    stock:          { read: true, write: false, delete: false, adjust: false },
    suppliers:      { read: false, write: false, delete: false },
    customers:      { read: false, write: false, delete: false },
    reports:        { read: false, write: false, delete: false },
    settings:       { read: false, write: false, delete: false },
    users:          { read: false, write: false, delete: false },
    sales:          { read: true, write: true, delete: false },
  },
};

// ─── Subscription plan definitions ──────────────────────────────────────────

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: number;
  period: string;
  badge?: string;
  highlighted: boolean;
  maxProducts: number | "unlimited";
  maxUsers: number | "unlimited";
  maxWarehouses: number | "unlimited";
  features: PlanFeature[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    period: "month",
    highlighted: false,
    maxProducts: 1000,
    maxUsers: 1,
    maxWarehouses: 2,
    features: [
      { label: "Up to 1,000 products",  included: true  },
      { label: "1 user included",        included: true  },
      { label: "2 warehouses",           included: true  },
      { label: "Basic reports",          included: true  },
      { label: "Email support",          included: true  },
      { label: "Advanced analytics",     included: false },
      { label: "API access",             included: false },
      { label: "Priority support",       included: false },
    ],
  },
  {
    id: "most_popular",
    name: "Professional",
    price: 79,
    period: "month",
    badge: "Most Popular",
    highlighted: true,
    maxProducts: 10000,
    maxUsers: 5,
    maxWarehouses: 10,
    features: [
      { label: "Up to 10,000 products",  included: true },
      { label: "5 users included",       included: true },
      { label: "10 warehouses",          included: true },
      { label: "Advanced reports",       included: true },
      { label: "Priority support",       included: true },
      { label: "API access",             included: true },
      { label: "Advanced analytics",     included: true },
      { label: "Dedicated manager",      included: false },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 199,
    period: "month",
    highlighted: false,
    maxProducts: "unlimited",
    maxUsers: "unlimited",
    maxWarehouses: "unlimited",
    features: [
      { label: "Unlimited products",     included: true },
      { label: "Unlimited users",        included: true },
      { label: "Unlimited warehouses",   included: true },
      { label: "Custom reports",         included: true },
      { label: "Dedicated support",      included: true },
      { label: "SLA & Onboarding",       included: true },
      { label: "API access",             included: true },
      { label: "Advanced analytics",     included: true },
    ],
  },
];

// ─── Domain models ───────────────────────────────────────────────────────────

/** users/{uid} — Global user profile */
// ── REMOVED: isSuperAdmin ──
export interface UserProfile {
  uid:                string;
  email:              string;
  displayName:        string;
  companyId:          string;
  role:               UserRole;
  status:             UserStatus;
  permissions:        UserPermissions;
  assignedWarehouseId?: string;
  createdAt:          FirebaseTimestamp | Date | string | null;
  updatedAt:          FirebaseTimestamp | Date | string | null;
}

/** companies/{companyId} */
export interface Company {
  id:                 string;
  name:               string;
  slug:               string;
  email:              string;
  phone?:             string;
  industry?:          string;
  plan:               SubscriptionPlan;
  /** overall company lifecycle state */
  status:             "trial" | "active" | "suspended" | "inactive";
  /** ISO string — set to now + 14 days on registration */
  trialEndsAt:        string;
  /** whether a paid subscription is active */
  subscriptionStatus: "trialing" | "active" | "cancelled" | "past_due";
  ownerId:            string;
  createdAt:          FirebaseTimestamp | Date;
  updatedAt:          FirebaseTimestamp | Date;
}

/** companies/{companyId}/users/{uid} */
export interface CompanyUser {
  uid:                string;
  email:              string;
  displayName:        string;
  companyId:          string;
  role:               UserRole;
  status:             UserStatus;
  permissions:        UserPermissions;
  assignedWarehouseId?: string;
  createdAt:          FirebaseTimestamp | Date;
  updatedAt:          FirebaseTimestamp | Date;
}

/** companies/{companyId}/categories/{categoryId} */
export interface Category {
  id:           string;
  name:         string;
  description?: string;
  companyId:    string;
  createdBy:    string;
  createdAt:    FirebaseTimestamp | Date;
  updatedAt:    FirebaseTimestamp | Date;
}

/** companies/{companyId}/products/{productId} */
export interface Product {
  id:            string;
  name:          string;
  sku:           string;
  categoryId:    string;
  categoryName:  string;
  price:         number;
  stockQuantity: number;
  status:        "in_stock" | "low_stock" | "out_of_stock";
  imageUrl?:     string;
  companyId:     string;
  createdBy:     string;
  createdAt:     FirebaseTimestamp | Date | string | null;
  updatedAt:     FirebaseTimestamp | Date | string | null;
  // Legacy compat / analytics fields
  product_name?:        string;
  product_Qty?:         number;
  product_Price?:       number;
  product_description?: string;
  size?:                string;
  img?:                 string;
  initialStock?:        number;
  timestamp?:           FirebaseTimestamp | Date | string | null;
}

export interface OrderItem { productId: string; name: string; qty: number; price: number; }
export interface Order {
  id:           string;
  orderNumber:  string;
  customerName: string;
  items:        OrderItem[];
  totalAmount:  number;
  status:       "pending" | "processing" | "completed" | "cancelled";
  companyId:    string;
  createdBy:    string;
  createdAt:    FirebaseTimestamp | Date;
  updatedAt:    FirebaseTimestamp | Date;
}

// ─── New domain models ───────────────────────────────────────────────────────

/** companies/{companyId}/warehouses/{warehouseId} */
export interface Warehouse {
  id:          string;
  name:        string;
  code:        string;        // e.g. "WH-001"
  address?:    string;
  city?:       string;
  country?:    string;
  isDefault:   boolean;
  companyId:   string;
  createdBy:   string;
  createdAt:   FirebaseTimestamp | Date;
  updatedAt:   FirebaseTimestamp | Date;
}

/** companies/{companyId}/inventory/{inventoryId} */
export interface InventoryRecord {
  id:            string;
  productId:     string;
  productName:   string;
  warehouseId:   string;
  warehouseName: string;
  quantity:      number;
  reservedQty:   number;       // qty reserved by pending orders
  availableQty:  number;       // quantity - reservedQty
  reorderLevel:  number;       // trigger low-stock alert below this
  companyId:     string;
  updatedAt:     FirebaseTimestamp | Date;
}

/** companies/{companyId}/transfers/{transferId} */
export interface Transfer {
  id:              string;
  transferNumber:  string;     // e.g. "TRF-001"
  fromWarehouseId: string;
  fromWarehouseName: string;
  toWarehouseId:   string;
  toWarehouseName: string;
  status:          "draft" | "pending" | "in_transit" | "completed" | "cancelled";
  items:           TransferItem[];
  notes?:          string;
  companyId:       string;
  createdBy:       string;
  createdAt:       FirebaseTimestamp | Date;
  updatedAt:       FirebaseTimestamp | Date;
}

/** companies/{companyId}/transfers/{transferId}/items/{itemId} */
export interface TransferItem {
  id:          string;
  productId:   string;
  productName: string;
  sku:         string;
  quantity:    number;
}

/** companies/{companyId}/stockMovements/{movementId} */
export type StockMovementType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "sale"
  | "return"
  | "damage";

export interface StockMovement {
  id:           string;
  productId:    string;
  productName:  string;
  sku:          string;
  warehouseId:  string;
  type:         StockMovementType;
  quantity:     number;         // positive = in, negative = out
  balanceBefore: number;
  balanceAfter:  number;
  reference?:   string;         // orderId / transferId / etc.
  notes?:       string;
  companyId:    string;
  createdBy:    string;
  createdAt:    FirebaseTimestamp | Date;
}

/** companies/{companyId}/suppliers/{supplierId} */
export interface Supplier {
  id:           string;
  name:         string;
  email?:       string;
  phone?:       string;
  address?:     string;
  contactPerson?: string;
  status:       "active" | "inactive";
  companyId:    string;
  createdBy:    string;
  createdAt:    FirebaseTimestamp | Date;
  updatedAt:    FirebaseTimestamp | Date;
}

/** companies/{companyId}/customers/{customerId} */
export interface Customer {
  id:           string;
  name:         string;
  email?:       string;
  phone?:       string;
  address?:     string;
  totalOrders:  number;
  totalSpent:   number;
  status:       "active" | "inactive";
  companyId:    string;
  createdBy:    string;
  createdAt:    FirebaseTimestamp | Date;
  updatedAt:    FirebaseTimestamp | Date;
}

/** companies/{companyId}/settings/general */
export interface GeneralSettings {
  companyName:    string;
  currency:       string;       // e.g. "USD", "NGN"
  timezone:       string;
  lowStockAlert:  number;       // default reorder level threshold
  logoUrl?:       string;
  address?:       string;
  updatedAt:      FirebaseTimestamp | Date;
}

/** companies/{companyId}/settings/roles */
export interface RolesSettings {
  roles: {
    [roleName: string]: {
      displayName: string;
      permissions: UserPermissions;
    };
  };
  updatedAt: FirebaseTimestamp | Date;
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────

export type BusinessProfile = Company & {
  businessName:    string;
  businessAddress: string;
  about?:          string;
  mission?:        string;
  logo?:           string;
  user_id?:        string;
};

// ── REMOVED: isSuperAdmin ──
export interface CurrentUser {
  uid:                string;
  email:              string | null;
  companyId?:         string;
  displayName?:       string;
  role?:              UserRole;
  assignedWarehouseId?: string;
}

// ─── Redux state shapes ──────────────────────────────────────────────────────

export interface ProductState    { productData: Product[];  isLoading: boolean; }
export interface BusinessState   { buzProfileData: BusinessProfile[]; isLoading: boolean; }
export interface CompanyState    { company: Company | null; companyId: string | null; isLoading: boolean; }

export interface CurrentUserState {
  user:    CurrentUser | null;
  profile: UserProfile | null;
  users:   CurrentUser[];
  status:  string;
  error:   string | null | undefined;
}

export interface ModalState { isOpen: boolean; }

// ─── Component prop types ────────────────────────────────────────────────────

export interface InputConfig {
  id:            number;
  name:          string;
  type:          string;
  placeholder:   string;
  label:         string;
  errMessages?:  string;
  pattern?:      string;
  required:      boolean;
  icon?:         ReactNode;
  value?:        string | number;
  onChange?:     (e: React.ChangeEvent<HTMLInputElement>) => void;
}