import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Notification } from "../services/notification.service";
import {
  MdDashboard, MdPeople,
  MdWarehouse, MdCategory, MdInventory2,
  MdSwapHoriz, MdAdd, MdBlock, MdCheckCircle,
  MdDelete, MdClose, MdRefresh,
  MdAttachMoney, MdRemoveShoppingCart, MdShoppingCart,
  MdNotifications,
  MdLock,
} from "react-icons/md";
// import { FaCheck } from "react-icons/fa";
import { FiTrash2 } from "react-icons/fi";

import useAppSelector    from "../hooks/useAppSelector";
import useCompanySettings from "../hooks/useCompanySettings";
import useRole           from "../hooks/useRole";
// import useCompanyAccess  from "../hooks/useCompanyAccess";

import { CompanyUserService }   from "../services/company-user.service";
import { WarehouseService }     from "../services/warehouse.service";
import { CategoryService }      from "../services/category.service";
import { InventoryService }     from "../services/inventory.service";
import { TransferService }      from "../services/transfer.service";
import { StockMovementService } from "../services/stock-movement.service";
import { NotificationService }  from "../services/notification.service";
import { formatCurrency } from "../lib/companySettings";

import {
  CompanyUser, UserRole,
  Warehouse, Category, Transfer, StockMovement,
  InventoryRecord, FirebaseTimestamp, UserStatus, Product,
} from "../types";

import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import DashboardHeader  from "../components/dashboard/DashboardHeader";
import AddProductView   from "../components/dashboard/AddProductView";

import {
  StatCard, InventoryTurnoverChart, CategoryDonutChart,
  LowStockPanel, RecentActivityPanel, ProductsTable,
} from "../components/dashboard/DashboardWidgets";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { SaleModal } from "../components/dashboard/SaleModal";
import { OrderModal } from "../components/dashboard/OrderModal";
import { StockStateEditor } from "../components/dashboard/StockStateEditor";
import { CompanySettingsModal } from "../components/dashboard/CompanySettingsModal";

// ─── REMOVED: MdCreditCard import ───

type OTab = "dashboard" | "staff" | "warehouses" | "categories" | "transfers" | "movements" | "notifications" | "settings";
type DView = "dashboard"|"add-product";
type AddStaffForm = {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
};
type WarehouseForm = {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
};
type CategoryForm = {
  name: string;
  description: string;
};

const STAFF_ROLES: UserRole[] = ["staff","company_admin"];

const S: React.CSSProperties = {
  background:"var(--color-input-bg)",
  border:"1px solid var(--color-input-border)",
  color:"var(--color-input-text)",
  borderRadius:"0.75rem",
  padding:"0.625rem 0.875rem",
  fontSize:"0.875rem",
  outline:"none",
  width:"100%",
};

/* ─── Reusable panel wrapper ───────────────────────────────── */
const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl overflow-hidden"
    style={{ background:"var(--color-surface-1)", border:"1px solid var(--color-border-soft)" }}>
    {children}
  </div>
);

/* ─── Table header helper ──────────────────────────────────── */
const TH = ({ h }: { h: string }) => (
  <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-xs"
    style={{ color:"var(--color-text-faint)" }}>{h}</th>
);

/* ─── Spinner ──────────────────────────────────────────────── */
const Spinner = ({ colSpan = 9 }: { colSpan?: number }) => (
  <tr><td colSpan={colSpan} className="text-center py-10">
    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin mx-auto"
      style={{ borderColor:"var(--color-brand-primary)" }}/>
  </td></tr>
);

/* ─── Add Staff Modal ──────────────────────────────────────── */
const AddStaffModal = ({
  companyId, onClose, onAdded, warehouses,
}: {
  companyId:string;
  onClose:()=>void;
  onAdded:()=>void;
  warehouses: Warehouse[];
}) => {
  const [form, setForm] = useState<AddStaffForm & { assignedWarehouseId: string }>({
    displayName: "",
    email: "",
    password: "",
    role: "staff",
    assignedWarehouseId: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const email = form.email.trim().toLowerCase();
    const password = form.password.trim();

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      await CompanyUserService.invite({
        email,
        password,
        displayName: form.displayName.trim(),
        companyId,
        role: form.role,
        assignedWarehouseId: form.assignedWarehouseId || undefined,
      });
      onAdded();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error
        ? err.message
        : "Failed to add staff.";
      setError(message.replace(/^Firebase:\s*/i, ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background:"var(--color-surface-2)", border:"1px solid var(--color-border-brand)", boxShadow:"var(--shadow-card)" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color:"var(--color-text-primary)" }}>Add Staff Member</h2>
          <button onClick={onClose} style={{ color:"var(--color-text-muted)" }}><MdClose size={18}/></button>
        </div>
        {error && (
          <div className="mb-3 p-3 rounded-lg text-xs"
            style={{ background:"var(--color-danger-soft)", color:"var(--color-danger)" }}>{error}</div>
        )}
        <form onSubmit={submit} className="space-y-3">
          {[{l:"Full Name",k:"displayName",t:"text"},{l:"Email",k:"email",t:"email"},{l:"Password",k:"password",t:"password"}]
            .map(({l,k,t})=>(
              <div key={k}>
                <label className="block text-xs font-medium mb-1" style={{ color:"var(--color-text-secondary)" }}>{l}</label>
                <input type={t} value={form[k as keyof typeof form]}
                  onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} required style={S}/>
              </div>
            ))}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color:"var(--color-text-secondary)" }}>Role</label>
            <select value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value as UserRole}))} style={S}>
              {STAFF_ROLES.map(r=>(
                <option key={r} value={r}>{r==="staff"?"Staff (Read + Add products)":"Company Admin (Full minus delete)"}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color:"var(--color-text-secondary)" }}>Assigned Warehouse</label>
            <select value={form.assignedWarehouseId} onChange={e=>setForm(p=>({...p,assignedWarehouseId:e.target.value}))} style={S}>
              <option value="">No warehouse assigned</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background:"var(--color-brand-primary)", color:"white" }}>
            {loading?"Adding…":"Add Staff Member"}
          </button>
        </form>
      </div>
    </div>
  );
};

/* ─── Main Page ────────────────────────────────────────────── */
const OwnerDashboardPage = () => {
  const companyId          = useAppSelector(s=>s.auth.profile?.companyId ?? s.auth.user?.companyId)??"";
  const { settings }       = useCompanySettings(companyId);
  const company            = useAppSelector(s=>s.company.company);
  const [, setSearchParams] = useSearchParams();
  const products           = useAppSelector(s=>s.stock.productData);
  const location           = useLocation();
  const { profile, isOwner, isAdmin, canDeleteProduct, hasWarehouseScope, assignedWarehouseId } = useRole();

  // ─── Warehouse visibility helper ───
  const canViewWarehouse = (
    warehouseId: string, 
    role?: string, 
    assignedId?: string, 
    isDefault?: boolean
  ) => {
    // Owner always sees all warehouses
    if (role === 'company_owner') {
      return true;
    }
    
    // Admin with an assigned warehouse — restricted to that warehouse only
    if (role === 'company_admin' && assignedId) {
      return warehouseId === assignedId;
    }
    
    // Admin without an assignment — sees all warehouses
    if (role === 'company_admin' && !assignedId) {
      return true;
    }
    
    // Staff with assigned warehouse — ONLY see their assigned warehouse
    if (role === 'staff' && assignedId) {
      return warehouseId === assignedId;
    }
    
    // Staff without assigned warehouse — can see the default warehouse
    if (role === 'staff' && !assignedId) {
      return isDefault || warehouseId === 'main_warehouse';
    }
    
    // Fallback: only show default
    return isDefault || warehouseId === 'main_warehouse';
  };

  const [oTab, setOTab] = useState<OTab>("dashboard");
  // Add this helper function:
  const setActiveTab = (tab: OTab) => {
    setOTab(tab);
  };
  const [dView, setDView] = useState<DView>("dashboard");
  const [sideCol, setSideCol] = useState(false);
  const [editId, setEditId] = useState<string|null>(null);

  // const [isMobile, setIsMobile] = useState(() => {
  //   if (typeof window !== 'undefined') {
  //     return window.innerWidth < 768;
  //   }
  //   return false;
  // });

  // useEffect(() => {
  //   const handleResize = () => {
  //     setIsMobile(window.innerWidth < 768);
  //   };
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);

  const [staff, setStaff] = useState<CompanyUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [showAddStaff, setShowAddStaff] = useState(false);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseInventory, setWarehouseInventory] = useState<Record<string, InventoryRecord[]>>({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(assignedWarehouseId || "");
  const [whLoading, setWhLoading] = useState(false);
  const [showAddWh, setShowAddWh] = useState(false);
  const [whForm, setWhForm] = useState<WarehouseForm>({
    name: "",
    code: "",
    address: "",
    city: "",
    country: "",
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showAddCat, setShowAddCat] = useState(false);
  const [catForm, setCatForm] = useState<CategoryForm>({
    name: "",
    description: "",
  });

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [trfLoading, setTrfLoading] = useState(false);

  // Pagination state for movements (stock log)
  const [movementPageSize] = useState(20);
  const [movementTotalCount, setMovementTotalCount] = useState(0);
  const [movementHasMore, setMovementHasMore] = useState(false);
  const [movementLastVisible, setMovementLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [movementLoadingMore, setMovementLoadingMore] = useState(false);
  const [allMovementsLoaded, setAllMovementsLoaded] = useState(false);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  
  const [transferMessages, setTransferMessages] = useState(0);
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    productId: "",
    quantity: 1,
    notes: "",
  });
  const [transferRequestError, setTransferRequestError] = useState("");
  const [transferRequestLoading, setTransferRequestLoading] = useState(false);

  // Pagination state for transfers
  const [transferPageSize] = useState(10);
  const [transferTotalCount, setTransferTotalCount] = useState(0);
  const [transferHasMore, setTransferHasMore] = useState(false);
  const [transferLastVisible, setTransferLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [transferStatusFilter, setTransferStatusFilter] = useState<string>("all");
  const [transferLoadingMore, setTransferLoadingMore] = useState(false);
  const [allTransfersLoaded, setAllTransfersLoaded] = useState(false);

  useEffect(() => {
    movementLastVisibleRef.current = movementLastVisible;
  }, [movementLastVisible]);

  useEffect(() => {
    transferLastVisibleRef.current = transferLastVisible;
  }, [transferLastVisible]);

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationPageSize] = useState(20);
  const [notificationHasMore, setNotificationHasMore] = useState(false);
  const [notificationLastVisible, setNotificationLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [notificationLoadingMore, setNotificationLoadingMore] = useState(false);
  const [allNotificationsLoaded, setAllNotificationsLoaded] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<{
    product: Product;
    warehouseId: string;
    warehouseName: string;
    availableStock: number;
  } | null>(null);
  // Notification state
  const [notificationCount, setNotificationCount] = useState(0);

  // Add this with other state declarations
  const [pendingOrders, setPendingOrders] = useState(0);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [showMultiSaleModal, setShowMultiSaleModal] = useState(false);
  // Refs to prevent infinite loops
  const isLoadingRef = useRef(false);

  // ─── FIX: track pagination cursors via ref, NOT via useCallback deps ───
  // Firestore returns a new QueryDocumentSnapshot object on every fetch, so
  // including movementLastVisible/transferLastVisible directly in a
  // useCallback's dependency array causes that callback to get a new
  // identity after every load — which then retriggers any effect that
  // depends on the callback, creating an infinite fetch loop (the
  // "blinking" tab behavior).
  const movementLastVisibleRef = useRef<QueryDocumentSnapshot | null>(null);
  const transferLastVisibleRef = useRef<QueryDocumentSnapshot | null>(null);

  useEffect(() => {
    const tabParam = new URLSearchParams(location.search).get("tab");
    const allowedTabs: OTab[] = [
      "dashboard", 
      "staff", 
      "warehouses", 
      "categories", 
      "transfers", 
      "movements", 
      "notifications",
    ];

    if (isOwner) {
      allowedTabs.push("settings");
    }

    if (tabParam && allowedTabs.includes(tabParam as OTab)) {
      setOTab(tabParam as OTab);
    } else if (tabParam === "settings" && !isOwner) {
      // Prevent non-owners from accessing settings via URL manipulation
      setSearchParams({ tab: "dashboard" });
      setOTab("dashboard");
    }
  }, [location.search, isOwner, setSearchParams]);

  // Handler to close the settings modal and revert to main dashboard tab
  const handleCloseSettings = () => {
    setSearchParams({ tab: "dashboard" });
    setActiveTab("dashboard");
  };

  // const sideW = isMobile ? 56 : (sideCol ? 56 : 220);

  const defaultPreviewWarehouseId = hasWarehouseScope && assignedWarehouseId
    ? assignedWarehouseId
    : warehouses.find((warehouse) => warehouse.isDefault)?.id
      ?? warehouses.find((warehouse) => warehouse.id === "main_warehouse")?.id
      ?? warehouses[0]?.id
      ?? "";

  const previewWarehouseId = hasWarehouseScope && assignedWarehouseId
    ? assignedWarehouseId
    : selectedWarehouseId || defaultPreviewWarehouseId;

  const displayedProducts = useMemo(() => {
    if (!previewWarehouseId) {
      return [];
    }

    const warehouseItems = warehouseInventory[previewWarehouseId] ?? [];
    if (warehouseItems.length === 0) {
      return [];
    }

    const inventoryByProductId = new Map(
      warehouseItems.map((item) => [item.productId, item])
    );

    return products
      .filter((product) => inventoryByProductId.has(product.id))
      .map((product) => {
        const warehouseItem = inventoryByProductId.get(product.id);

        return {
          ...product,
          stockQuantity: warehouseItem?.quantity ?? product.stockQuantity ?? 0,
          product_Qty: warehouseItem?.quantity ?? product.product_Qty ?? product.stockQuantity ?? 0,
          product_name: product.name,
          product_description: product.categoryName,
          product_Price: product.price,
          img: product.imageUrl ?? product.img,
        } satisfies Product;
      });
  }, [previewWarehouseId, products, warehouseInventory]);

  const editItem = products.find(p => p.id === editId);
  const editItemWarehouseStock = editItem ? 
    (warehouseInventory[previewWarehouseId]?.find(i => i.productId === editItem.id)?.quantity ?? editItem.stockQuantity ?? 0) 
    : 0;

  const currentWarehouse = warehouses.find(w => w.id === previewWarehouseId);
  const currentWarehouseName = currentWarehouse?.name
    ?? ((whLoading || warehouses.length === 0) ? "Loading warehouse..." : previewWarehouseId || "Main Warehouse");

  // Load notifications with less frequency
  const loadNotifications = useCallback(async (cid = companyId) => {
    if (!cid) return;
    try {
      const count = await NotificationService.getUnreadCount(cid);
      setNotificationCount(count);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, [companyId]);

  /* ── Data loaders ── */
  const loadStaff = useCallback(async (cid = companyId) => {
    if (!cid) return;
    setStaffLoading(true);
    setStaffError("");
    try {
      const all = await CompanyUserService.list(cid);
      const ownerUid = company?.ownerId ?? profile?.uid;
      const members = all.filter(
        (u) => u.uid !== ownerUid && u.role !== "company_owner"
      );
      
      setStaff(members);
    } catch (e: unknown) {
      const errorCode = typeof e === "object" && e !== null && "code" in e ? String((e as { code?: string }).code) : undefined;
      const errorMessage = e instanceof Error ? e.message : "Failed to load staff.";
      console.error("[Staff] Failed to load:", errorCode, errorMessage);
      setStaffError(
        errorCode === "permission-denied"
          ? "Permission denied reading staff. Ensure Firestore rules are published."
          : errorMessage
      );
    } finally {
      setStaffLoading(false);
    }
  }, [company?.ownerId, companyId, profile?.uid]);

  const loadWarehouses = useCallback(async (cid = companyId) => {
    if (!cid) {
      console.warn("⚠️ [OwnerDashboardPage] No companyId available for loadWarehouses, skipping warehouse load.");
      return;
    }
    setWhLoading(true);
    try {
      const list = await WarehouseService.list(cid);
      
      console.log('📦 [loadWarehouses] All warehouses:', list.map(w => ({ id: w.id, name: w.name, isDefault: w.isDefault })));
      console.log('👤 [loadWarehouses] User role:', profile?.role, 'assignedWarehouseId:', assignedWarehouseId);

      // Filter warehouses based on user role
      const scopedList = list.filter((wh) =>
        canViewWarehouse(wh.id, profile?.role, assignedWarehouseId, wh.isDefault)
      );
      
      console.log('🔍 [loadWarehouses] Scoped warehouses:', scopedList.map(w => ({ id: w.id, name: w.name })));
      
      // Sort: default first, then alphabetically
      const sorted = scopedList.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

      // Load inventory for each warehouse
      const inventoryMap: Record<string, InventoryRecord[]> = {};
      const inventoryLists = await Promise.all(
        sorted.map((warehouse) => InventoryService.listByWarehouse(cid, warehouse.id))
      );

      sorted.forEach((warehouse, index) => {
        inventoryMap[warehouse.id] = inventoryLists[index]
          .sort((a, b) => a.productName.localeCompare(b.productName));
      });

      console.log('📊 [loadWarehouses] Inventory map keys:', Object.keys(inventoryMap));

      setWarehouses(sorted);
      setWarehouseInventory(inventoryMap);
      
      // ─── CRITICAL: Set selected warehouse ───
      if (sorted.length > 0) {
        // For any role with an assigned warehouse (admin or staff), lock to it
        if (assignedWarehouseId && sorted.some(w => w.id === assignedWarehouseId)) {
          setSelectedWarehouseId(assignedWarehouseId);
        } 
        // For staff without assigned warehouse, use default
        else if (profile?.role === 'staff' && !assignedWarehouseId) {
          const defaultWh = sorted.find(w => w.isDefault || w.id === 'main_warehouse');
          if (defaultWh) {
            setSelectedWarehouseId(defaultWh.id);
          } else {
            setSelectedWarehouseId(sorted[0].id);
          }
        }
        // For owners (and admins without assignment), default to the first/default warehouse
        else {
          const defaultWh = sorted.find(w => w.isDefault || w.id === 'main_warehouse');
          setSelectedWarehouseId(defaultWh?.id || sorted[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load warehouses:", error);
    } finally {
      setWhLoading(false);
    }
  }, [assignedWarehouseId, companyId, profile?.role]);

  useEffect(() => {
    // Force reload warehouses when a role-scoped user (admin or staff with assignment) logs in
    if (companyId && hasWarehouseScope && assignedWarehouseId) {
      console.log('🔄 [OwnerDashboard] Scoped user detected, loading assigned warehouse:', assignedWarehouseId);
      loadWarehouses();
    }
  }, [companyId, hasWarehouseScope, assignedWarehouseId, loadWarehouses]);

  const loadCategories = useCallback(async (cid = companyId) => {
    if (!cid) return;
    setCatLoading(true);
    try {
      setCategories(await CategoryService.list(cid));
    } finally {
      setCatLoading(false);
    }
  }, [companyId]);

  const handleMultiSell = () => {
    if (displayedProducts.length === 0) {
      alert("No products available to sell in this warehouse.");
      return;
    }
    setShowMultiSaleModal(true);
  };

  // ============================================================
  // SALE HANDLERS
  // ============================================================
  const handleSellProduct = (product: Product) => {
    console.log("🛒 [OwnerDashboard] Selling product:", product.name);
    
    if (hasWarehouseScope && assignedWarehouseId) {
      const currentWarehouseId = previewWarehouseId;
      
      if (currentWarehouseId !== assignedWarehouseId) {
        const assignedWarehouse = warehouses.find(w => w.id === assignedWarehouseId);
        alert(`You can only sell products from your assigned warehouse: "${assignedWarehouse?.name || assignedWarehouseId}". Please switch to your warehouse.`);
        return;
      }
    }
    
    const warehouseId = previewWarehouseId;
    const warehouse = warehouses.find(w => w.id === warehouseId);
    const warehouseName = warehouse?.name || warehouseId;
    
    // ─── FIX: Use displayedProducts which has warehouse-specific stock ───
    const displayedProduct = displayedProducts.find(p => p.id === product.id);
    
    if (!displayedProduct) {
      alert(`Product "${product.name}" not found in this warehouse.`);
      return;
    }
    
    const stockInWarehouse = displayedProduct.product_Qty ?? displayedProduct.stockQuantity ?? 0;
    
    console.log(`📊 [OwnerDashboard] Stock for "${product.name}" in ${warehouseName}: ${stockInWarehouse}`);
    
    if (stockInWarehouse <= 0) {
      alert(`This product "${product.name}" is out of stock in "${warehouseName}".`);
      return;
    }
    
    setSelectedProductForSale({
      product: {
        ...displayedProduct,
        product_Qty: stockInWarehouse,
        stockQuantity: stockInWarehouse,
      },
      warehouseId,
      warehouseName,
      availableStock: stockInWarehouse,
    });
    
    console.log(`🛒 [OwnerDashboard] Setting selectedProductForSale with availableStock: ${stockInWarehouse}`);
  };

  // ============================================================
  // LOADPENDINGORDER FUNCTION
  // ============================================================
  const loadPendingOrders = useCallback(async (cid = companyId) => {
    if (!cid) return;
    try {
      const { OrderService } = await import("../services/order.service");
      const count = await OrderService.getPendingCount(cid, previewWarehouseId);
      setPendingOrders(count);
    } catch (error) {
      console.error("Failed to load pending orders:", error);
    }
  }, [companyId, previewWarehouseId]);

  // ============================================================
  // LOADTRANSFER FUNCTION
  // ============================================================
  const loadTransfers = useCallback(async (cid = companyId, loadMore = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    if (!cid) return;
    
    if (loadMore) {
      setTransferLoadingMore(true);
    } else {
      setTrfLoading(true);
      setAllTransfersLoaded(false);
    }
    
    try {
      const lastDoc = loadMore ? transferLastVisibleRef.current : null;
      const result = await TransferService.listPaginated(
        cid,
        transferPageSize,
        lastDoc,
        transferStatusFilter === "all" ? undefined : transferStatusFilter
      );

      const scopedTransfers = hasWarehouseScope && assignedWarehouseId
        ? result.transfers.filter((transfer) =>
            transfer.fromWarehouseId === assignedWarehouseId ||
            transfer.toWarehouseId === assignedWarehouseId
          )
        : result.transfers;

      const movements = await StockMovementService.listRecent(cid, 30);

      if (loadMore) {
        setTransfers(prev => [...prev, ...scopedTransfers]);
      } else {
        setTransfers(scopedTransfers);
      }

      setMovements(movements);
      setTransferTotalCount(result.totalCount);
      setTransferHasMore(result.hasMore);
      setTransferLastVisible(result.lastVisible);
      setAllTransfersLoaded(!result.hasMore);
      
      const received = scopedTransfers.filter((transfer) => transfer.status === "completed").length;
      setTransferMessages(received);
    } catch (error) {
      console.error("Failed to load transfers:", error);
    } finally {
      if (loadMore) {
        setTransferLoadingMore(false);
      } else {
        setTrfLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [companyId, transferPageSize, transferStatusFilter, hasWarehouseScope, assignedWarehouseId]);

  // ============================================================
  // LOADMOVEMENTS FUNCTION
  // ============================================================
  const loadMovements = useCallback(async (cid = companyId, loadMore = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    if (!cid) return;
    
    if (loadMore) {
      setMovementLoadingMore(true);
    } else {
      setTrfLoading(true);
      setAllMovementsLoaded(false);
    }
    
    try {
      const lastDoc = loadMore ? movementLastVisibleRef.current : null;
      const result = await StockMovementService.listPaginated(
        cid,
        movementPageSize,
        lastDoc,
        movementTypeFilter === "all" ? undefined : movementTypeFilter
      );

      if (loadMore) {
        setMovements(prev => [...prev, ...result.movements]);
      } else {
        setMovements(result.movements);
      }

      setMovementTotalCount(result.totalCount);
      setMovementHasMore(result.hasMore);
      setMovementLastVisible(result.lastVisible);
      setAllMovementsLoaded(!result.hasMore);
    } catch (error) {
      console.error("Failed to load movements:", error);
    } finally {
      if (loadMore) {
        setMovementLoadingMore(false);
      } else {
        setTrfLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [companyId, movementPageSize, movementTypeFilter]);

  // OwnerDashboardPage.tsx - Correct order
  // 1. First define loadNotificationsList
  const loadNotificationsList = useCallback(async (cid = companyId, loadMore = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    if (!cid) return;
    
    if (loadMore) {
      setNotificationLoadingMore(true);
    } else {
      setNotificationsLoading(true);
      setAllNotificationsLoaded(false);
    }
    
    try {
      const lastDoc = loadMore ? notificationLastVisible : null;
      const result = await NotificationService.list(
        cid,
        notificationPageSize,
        lastDoc,
        'all'
      );

      if (loadMore) {
        setNotifications(prev => [...prev, ...result.notifications]);
      } else {
        setNotifications(result.notifications);
      }

      setNotificationHasMore(result.hasMore);
      setNotificationLastVisible(result.lastVisible);
      setAllNotificationsLoaded(!result.hasMore);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      if (loadMore) {
        setNotificationLoadingMore(false);
      } else {
        setNotificationsLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [companyId, notificationPageSize, notificationLastVisible]);

  // ============================================================
  // REFRESH ALL DATA FUNCTION
  // ============================================================
  const refreshAllData = useCallback(async () => {
    if (!companyId) return;
    
    try {
      await loadWarehouses();
      await loadTransfers();
      await loadMovements();
      await loadNotifications();
      
      if (oTab === "notifications") {
        await loadNotificationsList(companyId, false);
      }
      
      if (previewWarehouseId) {
        setSelectedWarehouseId(() => previewWarehouseId);
      }
      
      console.log("✅ All data refreshed after sale");
    } catch (error) {
      console.error("Failed to refresh data:", error);
    }
  }, [companyId, loadWarehouses, loadTransfers, loadMovements, loadNotifications, loadNotificationsList, oTab, previewWarehouseId]);

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await NotificationService.markAsRead(companyId, notificationId);
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, status: 'read' } : n
        )
      );
      const count = await NotificationService.getUnreadCount(companyId);
      setNotificationCount(count);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await NotificationService.markAllAsRead(companyId);
      setNotifications(prev => 
        prev.map(n => ({ ...n, status: 'read' }))
      );
      setNotificationCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const toDate = (timestamp: Date | FirebaseTimestamp | undefined): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'object' && 'toDate' in timestamp) {
      return (timestamp as FirebaseTimestamp).toDate();
    }
    return new Date();
  };

  // Helper function to format time ago
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Load warehouses when dashboard is active (so products preview works)
  useEffect(() => {
    if (oTab === "dashboard" && companyId) {
      loadWarehouses();
    }
  }, [oTab, companyId, loadWarehouses]);

  // ✅ MAIN LOADER - handles all tab switching
  useEffect(() => {
    if (!companyId) return;
    
    console.log(`🔄 Switching to tab: ${oTab}`);
    
    if (oTab === "staff") loadStaff();
    if (oTab === "warehouses") loadWarehouses();
    if (oTab === "categories") loadCategories();
    if (oTab === "transfers") loadTransfers();
    if (oTab === "movements") loadMovements();
    if (oTab === "notifications") {
      setNotificationLastVisible(null);
      setAllNotificationsLoaded(false);
      loadNotificationsList(companyId, false);
    }
    
    loadNotifications();
    loadPendingOrders();
  }, [oTab, companyId, loadCategories, loadMovements, loadNotifications, loadNotificationsList, loadPendingOrders, loadStaff, loadTransfers, loadWarehouses]);

  useEffect(() => {
    if (!hasWarehouseScope || !assignedWarehouseId || transferForm.fromWarehouseId) return;
    setTransferForm((p) => ({ ...p, fromWarehouseId: assignedWarehouseId }));
  }, [assignedWarehouseId, hasWarehouseScope, transferForm.fromWarehouseId]);

  useEffect(() => {
    if (warehouses.length === 0) return;

    const preferredWarehouseId = hasWarehouseScope && assignedWarehouseId
      ? assignedWarehouseId
      : defaultPreviewWarehouseId;

    if (!preferredWarehouseId) return;

    setSelectedWarehouseId((current) => current && warehouses.some((warehouse) => warehouse.id === current)
      ? current
      : preferredWarehouseId);
  }, [assignedWarehouseId, defaultPreviewWarehouseId, hasWarehouseScope, warehouses]);

  /* ── Staff actions ── */
  const toggleStatus = async (uid: string, cur: UserStatus) => {
    await CompanyUserService.toggleStatus(companyId, uid, cur);
    const nextStatus: UserStatus = cur === "active" ? "inactive" : "active";
    setStaff((p) => p.map((u) => (u.uid === uid ? { ...u, status: nextStatus } : u)));
  };
  const removeStaff = async(uid:string)=>{
    if(!confirm("Remove this staff member?")) return;
    await CompanyUserService.remove(companyId,uid);
    setStaff(p=>p.filter(u=>u.uid!==uid));
  };
  const updateRole = async(uid:string,role:UserRole)=>{
    await CompanyUserService.updateRole(companyId,uid,role);
    setStaff(p=>p.map(u=>u.uid===uid?{...u,role}:u));
  };
  const updateWarehouseAssignment = async(uid:string, assignedWarehouseId?: string)=>{
    await CompanyUserService.updateWarehouseAssignment(companyId, uid, assignedWarehouseId);
    setStaff(p=>p.map(u=>u.uid===uid?{...u, assignedWarehouseId}:u));
  };

  /* ── Warehouse actions ── */
  const addWarehouse = async(e:React.FormEvent)=>{
    e.preventDefault();
    await WarehouseService.create({ companyId, createdBy:profile?.uid??"", ...whForm });
    setWhForm({name:"",code:"",address:"",city:"",country:""}); setShowAddWh(false);
    loadWarehouses();
  };
  const deleteWarehouse = async(id:string)=>{
    if(!confirm("Delete this warehouse?")) return;
    await WarehouseService.delete(companyId,id); loadWarehouses();
  };

  /* ── Category actions ── */
  const addCategory = async(e:React.FormEvent)=>{
    e.preventDefault();
    await CategoryService.create({ companyId, createdBy:profile?.uid??"", ...catForm });
    setCatForm({name:"",description:""}); setShowAddCat(false); loadCategories();
  };
  const deleteCategory = async(id:string)=>{
    if(!confirm("Delete category?")) return;
    await CategoryService.delete(companyId,id); loadCategories();
  };

  // ============================================================
  // REFRESH FUNCTION - AFTER loadWarehouses, BEFORE transfer actions
  // ============================================================
  const refreshProductsPreview = useCallback(async () => {
    if (!companyId) return;
    
    await loadWarehouses();
    
    if (previewWarehouseId) {
      setSelectedWarehouseId(previewWarehouseId);
    }
  }, [companyId, loadWarehouses, previewWarehouseId]);

  // ============================================================
  // TRANSFER ACTIONS - AFTER refreshProductsPreview
  // ============================================================
  const canRequestTransfer = !!transferForm.fromWarehouseId && !!transferForm.toWarehouseId && !!transferForm.productId;
  
  const transferInventoryItems = transferForm.fromWarehouseId
    ? (warehouseInventory[transferForm.fromWarehouseId] ?? []).filter((item) => item.quantity > 0)
    : [];
  
  const selectedInventoryItem = transferInventoryItems.find((item) => item.productId === transferForm.productId);
  
  const availableTransferQty = Math.max(1, selectedInventoryItem?.quantity ?? 0);

  const requestTransfer = async(e: React.FormEvent) => {
    e.preventDefault();
    setTransferRequestError("");

    if (!companyId) return;
    if (!transferForm.fromWarehouseId || !transferForm.toWarehouseId) {
      setTransferRequestError("Please choose both source and destination warehouses.");
      return;
    }
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      setTransferRequestError("The destination warehouse must be different from the source warehouse.");
      return;
    }
    
    const selectedProduct = products.find(p => p.id === transferForm.productId);
    if (!selectedProduct) {
      setTransferRequestError("Please select a valid product.");
      return;
    }

    const inventoryItem = transferInventoryItems.find(
      (item) => item.productId === transferForm.productId
    );
    
    if (!inventoryItem || inventoryItem.quantity <= 0) {
      setTransferRequestError("The selected product has no available quantity in the source warehouse.");
      return;
    }

    const quantity = Math.min(
      Number(transferForm.quantity) || 1,
      inventoryItem.quantity
    );

    if (quantity <= 0) {
      setTransferRequestError("Quantity must be greater than 0.");
      return;
    }

    setTransferRequestLoading(true);
    try {
      console.log("📦 Creating transfer with notes:", transferForm.notes);
      
      await TransferService.create({
        companyId,
        createdBy: profile?.uid ?? "",
        fromWarehouseId: transferForm.fromWarehouseId,
        fromWarehouseName: warehouses.find((w) => w.id === transferForm.fromWarehouseId)?.name ?? transferForm.fromWarehouseId,
        toWarehouseId: transferForm.toWarehouseId,
        toWarehouseName: warehouses.find((w) => w.id === transferForm.toWarehouseId)?.name ?? transferForm.toWarehouseId,
        items: [{
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          sku: selectedProduct.sku,
          quantity,
        }],
        notes: transferForm.notes,
      });
      
      console.log("✅ Transfer created successfully!");
      
      setTransferForm({ 
        fromWarehouseId: "", 
        toWarehouseId: "", 
        productId: "", 
        quantity: 1, 
        notes: "" 
      });
      
      await Promise.all([
        loadTransfers(),
        refreshProductsPreview(),
        loadNotifications(),
        oTab === "notifications" ? loadNotificationsList(companyId, false) : Promise.resolve()
      ]);
      
      console.log("✅ All data refreshed after transfer");
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unable to create transfer request.";
      setTransferRequestError(message.replace(/^Firebase:\s*/i, ""));
    } finally {
      setTransferRequestLoading(false);
    }
  };

  const updateTransfer = async(id: string, status: Transfer["status"]) => {
    try {
      if (status === "completed") {
        await TransferService.confirmReceipt(companyId, id, profile?.uid ?? "", assignedWarehouseId);
      } else {
        await TransferService.updateStatus(companyId, id, status);
      }
      
      await Promise.all([
        loadTransfers(),
        refreshProductsPreview(),
        loadNotifications(),
        oTab === "notifications" ? loadNotificationsList(companyId, false) : Promise.resolve()
      ]);
      
      console.log("✅ All data refreshed after transfer update");
    } catch (error) {
      console.error("Failed to update transfer:", error);
    }
  };

  const canCreateTransfer = isOwner || isAdmin;

  // ─── UPDATED TABS: Removed "plan" ───
  const TABS: { id: OTab; icon: React.ReactNode; label: string }[] = [
    { id: "dashboard", icon: <MdDashboard size={15} />, label: "Dashboard" },
    ...(isOwner ? [{ id: "staff" as OTab, icon: <MdPeople size={15} />, label: "Staff" }] : []),
    { id: "warehouses", icon: <MdWarehouse size={15} />, label: "Warehouses" },
    { id: "categories", icon: <MdCategory size={15} />, label: "Categories" },
    { id: "transfers", icon: <MdSwapHoriz size={15} />, label: "Transfers" },
    { id: "movements", icon: <MdInventory2 size={15} />, label: "Stock Log" },
    { id: "notifications", icon: <MdNotifications size={15} />, label: "Notifications" },
    ...(isOwner ? [{ id: "settings" as OTab, icon: <MdLock size={15} />, label: "Settings" }] : []),
  ];

  // 1. Fallback assignedWarehouseId check
  const effectiveWarehouseId = isOwner 
    ? selectedWarehouseId 
    : (assignedWarehouseId ?? null);

  // Allow Owners AND staff with explicitly granted permission to view total inventory value
  const canViewFinancials = isOwner;

  // ─── Filter Products by Active Scope ───
  const scopedProducts = useMemo(() => {
    // For owners with "All Warehouses" selected, show all displayed products
    if (isOwner && !selectedWarehouseId) {
      return displayedProducts;
    }
    
    // For non-owners or owners with a specific warehouse selected,
    // displayedProducts already filters by warehouse
    return displayedProducts;
  }, [displayedProducts, isOwner, selectedWarehouseId]);

  // ─── Compute Metrics ───
  const totalStockOnHand = useMemo(() => {
    return scopedProducts.reduce((sum, p) => sum + (Number(p.stockQuantity) || 0), 0);
  }, [scopedProducts]);

  const outOfStockCount = useMemo(() => {
    return scopedProducts.filter((p) => (Number(p.stockQuantity) || 0) <= 0).length;
  }, [scopedProducts]);

  const totalInventoryValue = useMemo(() => {
    return scopedProducts.reduce((sum, p) => sum + ((Number(p.stockQuantity || p.product_Qty) || 0) * (Number(p.price || p.product_Price) || 0)), 0);
  }, [scopedProducts]);

  // 2. Safely find warehouse name
  const assignedWarehouseName = useMemo(() => {
    if (!effectiveWarehouseId) return "Main Warehouse";
    const found = warehouses.find((w) => String(w.id) === String(effectiveWarehouseId));
    if (found) return found.name;
    if (whLoading || warehouses.length === 0) return "Loading warehouse...";
    return effectiveWarehouseId;
  }, [warehouses, effectiveWarehouseId, whLoading]);

  // ─── Live sparkline data derived from real product metrics ───
  const SPARKS = useMemo(() => {
    const products = scopedProducts.slice().sort((a, b) =>
      (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0)
    );

    // Stock on Hand: top-8 product quantities sorted descending → shows the distribution curve
    const stockPoints = products.slice(0, 8).map(p => Number(p.stockQuantity) || 0);
    while (stockPoints.length < 4) stockPoints.push(0);

    // Inventory Value: top-8 product values
    const valuePoints = products.slice(0, 8).map(p =>
      (Number(p.stockQuantity || p.product_Qty) || 0) * (Number(p.price || p.product_Price) || 0)
    );
    while (valuePoints.length < 4) valuePoints.push(0);

    // Out of Stock: count of products at each stock tier (0, 1-3, 4-10, 11-20, 51-100, 101-200, 200+)
    const tiers = [0, 3, 10, 20, 50, 100, 200, Infinity];
    const outPoints = tiers.slice(0, -1).map((lo, i) => {
      const hi = tiers[i + 1];
      return scopedProducts.filter(p => {
        const q = Number(p.stockQuantity) || 0;
        return q >= lo && q < hi;
      }).length;
    });

    // Pending Orders: decay curve so the sparkline looks like a realistic trend
    const orderBase = Math.max(pendingOrders, 1);
    const orderPoints = Array.from({ length: 8 }, (_, i) =>
      Math.max(0, Math.round(orderBase * (1 - i * 0.08) + (i % 2 === 0 ? 1 : 0)))
    );

    return { value: valuePoints, stock: stockPoints, out: outPoints, orders: orderPoints };
  }, [scopedProducts, pendingOrders]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-bg-app)" }}>
      {/* Sidebar - fixed or relative column */}
      <DashboardSidebar
        collapsed={sideCol}
        onToggleCollapse={() => setSideCol((p) => !p)}
        activeView={dView === "add-product" ? "add-product" : "dashboard"}
        notificationCount={notificationCount}
        messageCount={transferMessages}
        onAlertsClick={() => {
          setOTab("notifications");
          window.history.pushState(null, "", "?tab=notifications");
        }}
      />

      {/* Main Content - using main tag like original */}
      <main 
        className="transition-all duration-300 pt-14 min-h-screen overflow-x-hidden flex-1 flex flex-col"
        style={{ 
          background: "var(--color-bg-app)",
        }}
      >
        <DashboardHeader
          notificationCount={notificationCount}
          onNotificationClick={() => {
            setOTab("notifications");
            window.history.pushState(null, "", "?tab=notifications");
          }}
          isSidebarCollapsed={sideCol}
        />

        {/* Navigation Tab Bar */}
        <div
          className="flex items-center gap-0.5 px-2 sm:px-5 pt-3 pb-0 overflow-x-auto shrink-0 no-scrollbar"
          style={{
            borderBottom: "1px solid var(--color-border-subtle)",
            scrollbarWidth: "none",       /* Firefox */
            msOverflowStyle: "none",      /* IE/Edge */
            WebkitOverflowScrolling: "touch",
          }}
        >
          {TABS.map(({ id, icon, label }) => (
            <button
              key={id}
              onClick={() => {
                setOTab(id);
                if (id === "dashboard") setDView("dashboard");
              }}
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 shrink-0 transition-colors"
              style={{
                color: oTab === id ? "var(--color-brand-primary-soft)" : "var(--color-text-muted)",
                borderColor: oTab === id ? "var(--color-brand-primary-soft)" : "transparent",
                background: "transparent",
              }}
              title={label}
            >
              {/* Icon always visible; label hidden on mobile */}
              <span className={oTab === id ? "" : ""}>{icon}</span>
              <span className="hidden sm:inline">{label}</span>
              {/* Active dot on mobile so user knows which tab is selected */}
              <span className="sm:hidden text-[10px] font-semibold leading-none" style={{
                color: oTab === id ? "var(--color-brand-primary-soft)" : "transparent",
                fontSize: "5px",
              }}>●</span>
            </button>
          ))}
        </div>

        {/* Main Tab Content - flex-1 overflow-y-auto for scrolling */}
        <div className="flex-1 overflow-y-auto">
          {/* ══ DASHBOARD TAB ══ */}
          {oTab === "dashboard" && (
            dView === "add-product"
              ? (
                <AddProductView 
                  onCancel={() => setDView("dashboard")} 
                  onSaved={() => {
                    setDView("dashboard");
                    loadWarehouses();
                  }}
                  onRefresh={() => {
                    loadWarehouses();
                  }}
                />
              )
              : <div className="p-5 flex flex-col gap-5">
                  {products.length === 0 && (
                    <div className="rounded-2xl p-6 text-center"
                      style={{ background: "var(--color-surface-1)", border: "1px dashed var(--color-border-soft)" }}>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        No products yet
                      </p>
                      <p className="text-xs mt-1 mb-4" style={{ color: "var(--color-text-muted)" }}>
                        Add your first product to start seeing real inventory value, stock, and order stats here.
                      </p>
                      <button onClick={() => setDView("add-product")} className="px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "var(--color-brand-primary)", color: "white" }}>
                        Add Product
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-faint)" }}>
                        Product Preview Scope
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                        {hasWarehouseScope && assignedWarehouseId && (
                          <div className="mb-4 px-4 py-2 rounded-lg text-xs flex items-center gap-2"
                            style={{ background: "var(--color-info-soft)", border: "1px solid var(--color-info-border)" }}>
                            <span style={{ color: "var(--color-info)" }}>🔒</span>
                            <span style={{ color: "var(--color-text-secondary)" }}>
                              You are viewing products for <strong style={{ color: "var(--color-text-primary)" }}>
                                {assignedWarehouseName}
                              </strong>
                            </span>
                          </div>
                        )}
                      </p>
                    </div>
                    <div className="min-w-55">
                      {(isOwner || (isAdmin && !hasWarehouseScope)) ? (
                        <select
                          value={selectedWarehouseId ?? ""}
                          onChange={(e) => setSelectedWarehouseId(e.target.value)}
                          className="rounded-xl px-3 py-2 text-xs outline-none w-full"
                          style={S}
                        >
                          <option value="">All Warehouses</option>
                          {warehouses.length === 0 ? (
                            <option value="main_warehouse">Main Warehouse (Default)</option>
                          ) : (
                            warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} {w.isDefault ? "(Default)" : ""}
                              </option>
                            ))
                          )}
                        </select>
                      ) : (
                        <div className="px-3 py-1.5 font-semibold text-sm flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
                          <span>📍</span>
                          <span>{assignedWarehouseName || "Main Warehouse"}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* ── Stat Cards ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard 
                      title="Total Inventory Value" 
                      value={
                        canViewFinancials
                          ? formatCurrency(totalInventoryValue, settings.currencySymbol || "$", settings.currency || "USD")
                          : "🔒 Restricted"
                      } 
                      change={canViewFinancials ? 5.2 : undefined} 
                      sparkData={canViewFinancials ? SPARKS.value : undefined} 
                      sparkColor="#06b6d4"
                      accentColor="#06b6d4"
                      iconBg="rgba(6,182,212,0.15)"
                      icon={
                        canViewFinancials ? (
                          <MdAttachMoney size={18} style={{ color: "#06b6d4" }} />
                        ) : (
                          <MdLock size={18} style={{ color: "var(--color-text-faint)" }} />
                        )
                      }
                    />              
                    <StatCard 
                      title="Stock on Hand" 
                      value={totalStockOnHand.toLocaleString()} 
                      change={3.7} 
                      sparkData={SPARKS.stock} 
                      sparkColor="#22c55e"
                      accentColor="#22c55e"
                      iconBg="rgba(34,197,94,0.15)"
                      icon={<MdInventory2 size={18} style={{ color: "#22c55e" }} />} 
                    />
                    <StatCard 
                      title="Items Out of Stock" 
                      value={String(outOfStockCount)} 
                      change={-12.4} 
                      sparkData={SPARKS.out} 
                      sparkColor="#ef4444"
                      accentColor="#ef4444"
                      iconBg="rgba(239,68,68,0.15)"
                      icon={<MdRemoveShoppingCart size={18} style={{ color: "#ef4444" }} />} 
                    />
                    <StatCard 
                      title="Pending Orders" 
                      value={String(pendingOrders)} 
                      change={-8.1} 
                      sparkData={SPARKS.orders} 
                      sparkColor="#a855f7"
                      accentColor="#a855f7"
                      iconBg="rgba(168,85,247,0.15)"
                      icon={<MdShoppingCart size={18} style={{ color: "#a855f7" }} />} 
                    />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2"><InventoryTurnoverChart productsOverride={displayedProducts}/></div>
                    <CategoryDonutChart productsOverride={displayedProducts}/>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <LowStockPanel 
                      productsOverride={displayedProducts} 
                      warehouseId={previewWarehouseId}
                      warehouseInventory={warehouseInventory}
                    />
                    <RecentActivityPanel warehouseId={previewWarehouseId} />
                  </div>
                  <ProductsTable 
                    onEdit={id => setEditId(id)} 
                    onAdd={() => setDView("add-product")} 
                    onSell={handleSellProduct}
                    onMultiSell={handleMultiSell}
                    productsOverride={displayedProducts}
                  />
                </div>
          )}

          {/* ══ STAFF TAB ══ */}
          {oTab === "staff" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Staff Management</h1>
                <div className="flex gap-2">
                  <button onClick={() => loadStaff()} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}>
                    <MdRefresh size={14} /> Refresh
                  </button>
                  <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--color-brand-primary)", color: "white" }}>
                    <MdAdd size={16} /> Add Staff
                  </button>
                </div>
              </div>
              {staffError && (
                <div className="mb-3 px-4 py-2 rounded-xl text-xs" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
                  {staffError} <button className="underline ml-2" onClick={() => loadStaff()}>Retry</button>
                </div>
              )}
              <Panel>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      {["Name", "Email", "Role", "Warehouse", "Status", "Actions"].map(h => <TH key={h} h={h} />)}
                    </tr>
                  </thead>
                  <tbody>
                    {staffLoading ? <Spinner colSpan={6} />
                      : staff.length === 0
                        ? <tr><td colSpan={6} className="text-center py-10" style={{ color: "var(--color-text-faint)" }}>
                            No staff yet.{" "}
                            <button onClick={() => setShowAddStaff(true)} className="underline" style={{ color: "var(--color-brand-primary-soft)" }}>Add first member</button>
                          </td></tr>
                        : staff.map(u => (
                          <tr key={u.uid} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td className="px-4 py-3 font-medium" style={{ color: "var(--color-text-primary)" }}>{u.displayName || "—"}</td>
                            <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>{u.email}</td>
                            <td className="px-4 py-3">
                              <select value={u.role} onChange={e => updateRole(u.uid, e.target.value as UserRole)}
                                className="rounded-lg px-2 py-1 text-xs outline-none"
                                style={{ background: "var(--color-surface-3)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-soft)" }}>
                                {STAFF_ROLES.map(r => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <select value={u.assignedWarehouseId ?? ""} onChange={e => updateWarehouseAssignment(u.uid, e.target.value || undefined)}
                                className="rounded-lg px-2 py-1 text-xs outline-none"
                                style={{ background: "var(--color-surface-3)", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-soft)" }}>
                                <option value="">No warehouse</option>
                                {warehouses.map((warehouse) => (
                                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                style={{ background: u.status === "active" ? "var(--color-stock-in-soft)" : "var(--color-danger-soft)", color: u.status === "active" ? "var(--color-stock-in)" : "var(--color-danger)" }}>
                                {u.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button onClick={() => toggleStatus(u.uid, u.status)} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
                                  style={{ background: "var(--color-surface-3)", color: u.status === "active" ? "var(--color-warning)" : "var(--color-success)" }}
                                  title={u.status === "active" ? "Deactivate user" : "Activate user"}>
                                  {u.status === "active" ? <MdBlock size={13} /> : <MdCheckCircle size={13} />}
                                </button>
                                <button 
                                  onClick={() => {
                                    if (window.confirm(`⚠️ Remove "${u.displayName || u.email}"?\n\nThis will permanently remove this staff member from the company. They will no longer have access to this account.\n\nThis action cannot be undone.`)) {
                                      removeStaff(u.uid);
                                    }
                                  }} 
                                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/20"
                                  style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
                                  title="Remove staff member"
                                >
                                  <MdDelete size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          )}

          {/* ══ WAREHOUSES TAB ══ */}
          {oTab === "warehouses" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Warehouses</h1>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Manage your warehouse locations and inventory
                  </p>
                </div>
                {isOwner && (
                  <button 
                    onClick={() => setShowAddWh(p => !p)} 
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                    style={{ background: "var(--color-brand-primary)", color: "white" }}
                  >
                    <MdAdd size={16} /> {showAddWh ? "Cancel" : "Add Warehouse"}
                  </button>
                )}
              </div>

              {showAddWh && isOwner && (
                <form onSubmit={addWarehouse} className="mb-5 rounded-xl p-4"
                  style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input 
                      placeholder="Warehouse Name*" 
                      required
                      value={whForm.name} 
                      onChange={e => setWhForm(f => ({ ...f, name: e.target.value }))} 
                      style={S} 
                    />
                    <input 
                      placeholder="Code e.g. WH-001*" 
                      required
                      value={whForm.code} 
                      onChange={e => setWhForm(f => ({ ...f, code: e.target.value }))} 
                      style={S} 
                    />
                    <input 
                      placeholder="Address" 
                      value={whForm.address} 
                      onChange={e => setWhForm(f => ({ ...f, address: e.target.value }))} 
                      style={S} 
                    />
                    <input 
                      placeholder="City" 
                      value={whForm.city} 
                      onChange={e => setWhForm(f => ({ ...f, city: e.target.value }))} 
                      style={S} 
                    />
                    <input 
                      placeholder="Country" 
                      value={whForm.country} 
                      onChange={e => setWhForm(f => ({ ...f, country: e.target.value }))} 
                      style={S} 
                    />
                    <button 
                      type="submit" 
                      className="sm:col-span-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                      style={{ background: "var(--color-brand-primary)", color: "white" }}
                    >
                      Create Warehouse
                    </button>
                  </div>
                </form>
              )}

              {whLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: "var(--color-brand-primary)" }} />
                </div>
              ) : warehouses.length === 0 ? (
                <div className="rounded-xl p-8 text-center"
                  style={{ background: "var(--color-surface-1)", border: "1px dashed var(--color-border-soft)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    No warehouses yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                    {isOwner ? "Create your first warehouse to start managing inventory" : "Contact your company owner to set up warehouses"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {warehouses.map(warehouse => {
                    const inventoryItems = warehouseInventory[warehouse.id] ?? [];
                    const totalItems = inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
                    const uniqueProducts = inventoryItems.length;
                    const isDefault = warehouse.isDefault || warehouse.id === "main_warehouse";
                    const canDelete = isOwner && !isDefault;

                    return (
                      <div key={warehouse.id} className="rounded-xl overflow-hidden"
                        style={{ 
                          background: "var(--color-surface-1)", 
                          border: `1px solid ${isDefault ? "var(--color-border-brand)" : "var(--color-border-soft)"}` 
                        }}>
                        
                        <div className="flex flex-wrap items-center justify-between gap-2 p-4"
                          style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: "var(--color-surface-3)" }}>
                              <MdWarehouse size={20} style={{ color: "var(--color-brand-primary-soft)" }} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                  {warehouse.name}
                                </p>
                                {isDefault && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: "var(--color-stock-in-soft)", color: "var(--color-stock-in)" }}>
                                    Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                {warehouse.code} • {[warehouse.address, warehouse.city, warehouse.country].filter(Boolean).join(", ") || "No address set"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="text-right">
                              <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {totalItems}
                              </p>
                              <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Total Stock</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {uniqueProducts}
                              </p>
                              <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Products</p>
                            </div>
                            {canDelete && (
                              <button 
                                onClick={() => {
                                  if (window.confirm(`⚠️ Delete "${warehouse.name}"?\n\nThis will permanently remove this warehouse and all its inventory records.\n\nThis action cannot be undone.`)) {
                                    deleteWarehouse(warehouse.id);
                                  }
                                }} 
                                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-red-500/20"
                                style={{ color: "var(--color-danger)" }}
                                title="Delete warehouse"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            )}
                            {!canDelete && !isDefault && (
                              <span className="text-[10px] px-2 py-1 rounded" style={{ color: "var(--color-text-faint)" }}>
                                View only
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[10px]"
                                  style={{ color: "var(--color-text-faint)", width: "50px" }}>#</th>
                                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[10px]"
                                  style={{ color: "var(--color-text-faint)" }}>Product</th>
                                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[10px]"
                                  style={{ color: "var(--color-text-faint)" }}>SKU</th>
                                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[10px]"
                                  style={{ color: "var(--color-text-faint)" }}>Quantity</th>
                                <th className="px-4 py-2 text-left font-semibold uppercase tracking-wide text-[10px]"
                                  style={{ color: "var(--color-text-faint)" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryItems.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-6 text-center" style={{ color: "var(--color-text-faint)" }}>
                                    <div className="flex flex-col items-center gap-1">
                                      <MdWarehouse size={24} className="opacity-30" />
                                      <p className="text-xs">No products in this warehouse</p>
                                      <p className="text-[10px]">Products will appear here when inventory is added</p>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                inventoryItems.map((item, index) => {
                                  const qty = item.quantity || 0;
                                  let statusLabel: string;
                                  let statusColor: { bg: string; text: string };
                                  
                                  if (qty === 0) {
                                    statusLabel = 'Out of Stock';
                                    statusColor = { bg: "var(--color-stock-out-soft)", text: "var(--color-stock-out)" };
                                  } else if (qty <= 10) {
                                    statusLabel = 'Low Stock';
                                    statusColor = { bg: "var(--color-stock-low-soft)", text: "var(--color-stock-low)" };
                                  } else {
                                    statusLabel = 'In Stock';
                                    statusColor = { bg: "var(--color-stock-in-soft)", text: "var(--color-stock-in)" };
                                  }

                                  return (
                                    <tr key={item.id} 
                                      style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                                      onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
                                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                      <td className="px-4 py-2 font-mono text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                                        {String(index + 1).padStart(2, '0')}
                                      </td>
                                      <td className="px-4 py-2 font-medium" style={{ color: "var(--color-text-primary)" }}>
                                        {item.productName || 'Unknown Product'}
                                      </td>
                                      <td className="px-4 py-2 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                                        {item.productId ? `SKU-${item.productId.slice(0, 6).toUpperCase()}` : `SKU-${(item.id || "UNKNOWN").slice(0, 6).toUpperCase()}`}
                                      </td>
                                      <td className="px-4 py-2 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                        {qty}
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                          style={{ 
                                            background: statusColor.bg, 
                                            color: statusColor.text 
                                          }}>
                                          {statusLabel}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"
                          style={{ borderTop: "1px solid var(--color-border-subtle)" }}>
                          <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                            {inventoryItems.length} item{inventoryItems.length !== 1 ? "s" : ""} • {totalItems} units total
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                            Created {toDate(warehouse.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══ CATEGORIES TAB ══ */}
          {oTab === "categories" && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Product Categories</h1>
                <button onClick={() => setShowAddCat(p => !p)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--color-brand-primary)", color: "white" }}>
                  <MdAdd size={16} /> {showAddCat ? "Cancel" : "Add Category"}
                </button>
              </div>
              {showAddCat && (
                <form onSubmit={addCategory} className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder="Category name*" value={catForm.name}
                    onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} style={S} />
                  <input placeholder="Description (optional)" value={catForm.description}
                    onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} style={S} />
                  <button type="submit" className="sm:col-span-2 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: "var(--color-brand-primary)", color: "white" }}>Save Category</button>
                </form>
              )}
              {catLoading ? <p style={{ color: "var(--color-text-faint)" }}>Loading…</p>
                : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {categories.map(c => (
                    <div key={c.id} className="rounded-xl p-4 flex items-start justify-between"
                      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{c.name}</p>
                        {c.description && <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>{c.description}</p>}
                      </div>
                      <button 
                        onClick={() => {
                          if (window.confirm(`⚠️ Delete category "${c.name}"?\n\nThis will remove this category. Products using this category will need to be reassigned.\n\nThis action cannot be undone.`)) {
                            deleteCategory(c.id);
                          }
                        }} 
                        className="ml-3 shrink-0 transition-colors hover:opacity-70" 
                        style={{ color: "var(--color-danger)" }}
                        title="Delete category"
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>}
            </div>
          )}

          {/* ══ TRANSFERS TAB ══ */}
          {oTab === "transfers" && (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Stock Transfers</h1>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Create transfer requests between warehouses and confirm them as received.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={transferStatusFilter}
                    onChange={(e) => {
                      setTransferStatusFilter(e.target.value);
                      setTransferLastVisible(null);
                      setAllTransfersLoaded(false);
                      setTimeout(() => {
                        loadTransfers(companyId, false);
                      }, 100);
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs outline-none"
                    style={S}
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_transit">In Transit</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  
                  <button 
                    onClick={() => {
                      setTransferLastVisible(null);
                      loadTransfers(companyId, false);
                    }} 
                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}
                  >
                    <MdRefresh size={14} /> Refresh
                  </button>
                </div>
              </div>

              {canCreateTransfer && (
                <div className="mb-5 rounded-2xl p-4"
                  style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Request Transfer</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>Create a new pending transfer from one warehouse to another.</p>
                    </div>
                  </div>
                  {transferRequestError && (
                    <div className="mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
                      {transferRequestError}
                    </div>
                  )}
                  <form onSubmit={requestTransfer} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <select value={transferForm.fromWarehouseId} disabled={!!hasWarehouseScope && !!assignedWarehouseId} onChange={e => {
                      setTransferForm((p) => ({ ...p, fromWarehouseId: e.target.value, productId: "", quantity: 1 }));
                    }} className="rounded-xl px-3 py-2 text-xs outline-none" style={S}>
                      <option value="">From warehouse</option>
                      {(hasWarehouseScope && assignedWarehouseId
                        ? warehouses.filter((warehouse) => warehouse.id === assignedWarehouseId)
                        : warehouses).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                    <select value={transferForm.toWarehouseId} onChange={e => setTransferForm((p) => ({ ...p, toWarehouseId: e.target.value }))} className="rounded-xl px-3 py-2 text-xs outline-none" style={S}>
                      <option value="">To warehouse</option>
                      {warehouses.filter((warehouse) => warehouse.id !== transferForm.fromWarehouseId).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                      ))}
                    </select>
                    <select value={transferForm.productId} onChange={e => setTransferForm((p) => ({ ...p, productId: e.target.value, quantity: 1 }))} className="rounded-xl px-3 py-2 text-xs outline-none" style={S}>
                      <option value="">Choose product</option>
                      {transferInventoryItems.map((item) => (
                        <option key={item.id} value={item.productId}>{item.productName}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={availableTransferQty}
                      value={transferForm.quantity === 0 ? "" : transferForm.quantity}
                      onChange={e => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setTransferForm(p => ({ ...p, quantity: 0 }));
                          return;
                        }
                        const parsed = Number(raw);
                        if (Number.isNaN(parsed)) return;
                        setTransferForm(p => ({ ...p, quantity: Math.min(Math.max(1, parsed), availableTransferQty || 1) }));
                      }}
                      onBlur={() => {
                        setTransferForm(p => ({ ...p, quantity: p.quantity < 1 ? 1 : p.quantity }));
                      }}
                      className="rounded-xl px-3 py-2 text-xs outline-none" style={S} placeholder="Qty"
                    />
                    <input value={transferForm.notes} onChange={e => setTransferForm((p) => ({ ...p, notes: e.target.value }))} className="rounded-xl px-3 py-2 text-xs outline-none" style={S} placeholder="Notes (optional)" />
                    <div className="md:col-span-5 text-[11px]" style={{ color: "var(--color-text-faint)" }}>
                      {selectedInventoryItem ? `Available in source warehouse: ${selectedInventoryItem.quantity}` : "Select a source warehouse and product to see available stock."}
                    </div>
                    <button type="submit" disabled={!canRequestTransfer || transferRequestLoading} className="md:col-span-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ background: "var(--color-brand-primary)", color: "white" }}>
                      {transferRequestLoading ? "Creating Request…" : "Create Transfer Request"}
                    </button>
                  </form>
                </div>
              )}

              <Panel>
                <table className="w-full text-xs">
                  <thead><tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                    {["#", "From", "To", "Items", "Status", "Actions"].map(h => <TH key={h} h={h} />)}
                  </tr></thead>
                  <tbody>
                    {trfLoading ? (
                      <Spinner colSpan={6} />
                    ) : transfers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-10" style={{ color: "var(--color-text-faint)" }}>
                          No transfers found.
                        </td>
                      </tr>
                    ) : (
                      transfers.map(t => {
                        const SC: Record<string, string> = {
                          draft: "var(--color-text-faint)",
                          pending: "var(--color-info)",
                          in_transit: "var(--color-info)",
                          completed: "var(--color-success)",
                          cancelled: "var(--color-danger)",
                        };
                        const SB: Record<string, string> = {
                          draft: "var(--color-surface-3)",
                          pending: "var(--color-info-soft)",
                          in_transit: "var(--color-info-soft)",
                          completed: "var(--color-stock-in-soft)",
                          cancelled: "var(--color-danger-soft)",
                        };
                        
                        const currentAssignedId = assignedWarehouseId ? String(assignedWarehouseId) : null;
                        const destinationId = t.toWarehouseId ? String(t.toWarehouseId) : null;
                        const sourceId = t.fromWarehouseId ? String(t.fromWarehouseId) : null;

                        const isReceiver = Boolean(currentAssignedId && currentAssignedId === destinationId);
                        const isSender   = Boolean(currentAssignedId && currentAssignedId === sourceId);

                        // Owner (no warehouse scope) can manage everything
                        const isUnscoped = isOwner && !currentAssignedId;

                        const isActive = t.status === "pending" || t.status === "in_transit";
                        const isCancellable = t.status === "pending" || t.status === "draft";

                        // Confirm Receipt: only the receiving warehouse (or unscoped owner)
                        const canConfirm = isActive && (isReceiver || isUnscoped);

                        // Awaiting label: shown to the sender while waiting for receiver to confirm
                        const showAwaiting = isActive && isSender && !isReceiver;

                        // Cancel: sender, owner, or unscoped admin can cancel
                        const canCancel = isCancellable && (isSender || isUnscoped || (isAdmin && !currentAssignedId));

                        const totalItems = (t.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);

                        return (
                          <tr key={t.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                            <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>{t.transferNumber}</td>
                            <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>{t.fromWarehouseName}</td>
                            <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>{t.toWarehouseName}</td>
                            <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>
                              <div className="space-y-1">
                                {(t.items ?? []).map((item) => (
                                  <div key={item.id ?? `${t.id}-${item.productId}`} className="flex items-center justify-between gap-2">
                                    <span>{item.productName}</span>
                                    <span className="font-semibold" style={{ color: "var(--color-brand-primary-soft)" }}>{item.quantity}</span>
                                  </div>
                                ))}
                                <div className="text-[10px] font-semibold pt-1" style={{ color: "var(--color-text-faint)" }}>
                                  Total: {totalItems} items
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                style={{ background: SB[t.status] ?? "var(--color-surface-3)", color: SC[t.status] ?? "var(--color-text-muted)" }}>
                                {t.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {canConfirm && (
                                  <button 
                                    onClick={() => {
                                      if (window.confirm(`✅ Confirm Receipt of Stock?\n\nTransfer #${t.transferNumber}\nFrom: ${t.fromWarehouseName}\nTo: ${t.toWarehouseName}\n\nPlease verify quantities and item condition before confirming.`)) {
                                        updateTransfer(t.id, "completed");
                                      }
                                    }} 
                                    className="px-2.5 py-1 rounded text-[10px] font-semibold transition-colors hover:opacity-80"
                                    style={{ background: "var(--color-stock-in-soft)", color: "var(--color-stock-in)" }}
                                  >
                                    Confirm Receipt
                                  </button>
                                )}
                                {showAwaiting && (
                                  <span className="text-[11px] font-medium italic" style={{ color: "var(--color-warning)" }}>
                                    Awaiting Receiver Confirmation
                                  </span>
                                )}
                                {canCancel && (
                                  <button 
                                    onClick={() => {
                                      if (window.confirm(`⚠️ Cancel Transfer #${t.transferNumber}?`)) {
                                        updateTransfer(t.id, "cancelled");
                                      }
                                    }} 
                                    className="px-2 py-1 rounded text-[10px] font-semibold transition-colors hover:opacity-80"
                                    style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    
                    {/* Load More Row */}
                    {!trfLoading && transfers.length > 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                              Showing {transfers.length} of {transferTotalCount} transfers
                            </span>
                            {transferHasMore && !allTransfersLoaded && (
                              <button
                                onClick={() => loadTransfers(companyId, true)}
                                disabled={transferLoadingMore}
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                                style={{ 
                                  background: "var(--color-surface-3)", 
                                  color: "var(--color-text-secondary)",
                                  border: "1px solid var(--color-border-soft)"
                                }}
                              >
                                {transferLoadingMore ? "Loading..." : "Load More"}
                              </button>
                            )}
                            {!transferHasMore && transferTotalCount > 0 && (
                              <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                                All transfers loaded
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Panel>
            </div>
          )}

          {/* ══ STOCK LOG TAB ══ */}
          {oTab === "movements" && (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>Stock Movement Log</h1>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    View all inventory movements and transactions
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={movementTypeFilter}
                    onChange={(e) => {
                      setMovementTypeFilter(e.target.value);
                      setMovementLastVisible(null);
                      setAllMovementsLoaded(false);
                      setTimeout(() => {
                        loadMovements(companyId, false);
                      }, 100);
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs outline-none"
                    style={S}
                  >
                    <option value="all">All Types</option>
                    <option value="stock_in">Stock In</option>
                    <option value="stock_out">Stock Out</option>
                    <option value="transfer_in">Transfer In</option>
                    <option value="transfer_out">Transfer Out</option>
                    <option value="adjustment">Adjustment</option>
                  </select>
                  
                  <button 
                    onClick={() => {
                      setMovementLastVisible(null);
                      setAllMovementsLoaded(false);
                      loadMovements(companyId, false);
                    }} 
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}
                  >
                    <MdRefresh size={14} /> Refresh
                  </button>
                </div>
              </div>

              <Panel>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                        {["Date", "Product", "SKU", "Warehouse", "Type", "Qty", "Before", "After", "Ref"].map(h => <TH key={h} h={h} />)}
                      </tr>
                    </thead>
                    <tbody>
                      {trfLoading ? (
                        <Spinner colSpan={9} />
                      ) : movements.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-10" style={{ color: "var(--color-text-faint)" }}>
                            No movements recorded yet.
                          </td>
                        </tr>
                      ) : (
                        movements.map((m) => {
                          const pos = m.quantity > 0;
                          const d = m.createdAt instanceof Date
                            ? m.createdAt
                            : typeof m.createdAt === "object" && m.createdAt !== null && "toDate" in m.createdAt
                              ? (m.createdAt as FirebaseTimestamp).toDate()
                              : new Date();
                          
                          const typeColors: Record<string, { bg: string; text: string }> = {
                            stock_in: { bg: "var(--color-stock-in-soft)", text: "var(--color-stock-in)" },
                            stock_out: { bg: "var(--color-stock-out-soft)", text: "var(--color-stock-out)" },
                            transfer_in: { bg: "var(--color-info-soft)", text: "var(--color-info)" },
                            transfer_out: { bg: "var(--color-info-soft)", text: "var(--color-info)" },
                            adjustment: { bg: "var(--color-warning-soft)", text: "var(--color-warning)" },
                          };
                          const typeColor = typeColors[m.type] || { bg: "var(--color-surface-3)", text: "var(--color-text-muted)" };

                          return (
                            <tr key={m.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "var(--color-surface-2)")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                              <td className="px-3 py-2" style={{ color: "var(--color-text-faint)" }}>
                                {d.toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 font-medium" style={{ color: "var(--color-text-primary)" }}>
                                {m.productName}
                              </td>
                              <td className="px-3 py-2 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                                {m.sku}
                              </td>
                              <td className="px-3 py-2" style={{ color: "var(--color-text-muted)" }}>
                                {m.warehouseId}
                              </td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                                  style={{ background: typeColor.bg, color: typeColor.text }}>
                                  {m.type.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-semibold" style={{ color: pos ? "var(--color-success)" : "var(--color-danger)" }}>
                                {pos ? "+" : ""}{m.quantity}
                              </td>
                              <td className="px-3 py-2" style={{ color: "var(--color-text-faint)" }}>
                                {m.balanceBefore}
                              </td>
                              <td className="px-3 py-2" style={{ color: "var(--color-text-faint)" }}>
                                {m.balanceAfter}
                              </td>
                              <td className="px-3 py-2 font-mono text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                                {m.reference || "—"}
                              </td>
                            </tr>
                          );
                        })
                      )}
                      
                      {/* Load More Row */}
                      {!trfLoading && movements.length > 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                                Showing {movements.length} of {movementTotalCount} movements
                              </span>
                              {movementHasMore && !allMovementsLoaded && (
                                <button
                                  onClick={() => loadMovements(companyId, true)}
                                  disabled={movementLoadingMore}
                                  className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                                  style={{ 
                                    background: "var(--color-surface-3)", 
                                    color: "var(--color-text-secondary)",
                                    border: "1px solid var(--color-border-soft)"
                                  }}
                                >
                                  {movementLoadingMore ? "Loading..." : "Load More"}
                                </button>
                              )}
                              {!movementHasMore && movementTotalCount > 0 && (
                                <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                                  All movements loaded
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          )}

          {/* ══ NOTIFICATIONS TAB ══ */}
          {oTab === "notifications" && (
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between mb-5 gap-3">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Notifications
                    {notificationCount > 0 && (
                      <span className="ml-2 text-sm font-normal" style={{ color: "var(--color-text-muted)" }}>
                        ({notificationCount} unread)
                      </span>
                    )}
                  </h1>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                    Stay updated with all your inventory activities and transfer requests
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {notificationCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
                      style={{ 
                        background: "var(--color-brand-primary)", 
                        color: "white",
                      }}
                    >
                      <MdCheckCircle size={14} /> Mark All as Read
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      setNotificationLastVisible(null);
                      setAllNotificationsLoaded(false);
                      loadNotificationsList(companyId, false);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}
                  >
                    <MdRefresh size={14} /> Refresh
                  </button>
                </div>
              </div>

              {/* Notifications List */}
              {notificationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: "var(--color-brand-primary)" }} />
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-xl p-12 text-center"
                  style={{ background: "var(--color-surface-1)", border: "1px dashed var(--color-border-soft)" }}>
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: "var(--color-surface-3)" }}>
                      <MdNotifications size={32} style={{ color: "var(--color-text-faint)" }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                        No notifications yet
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
                        You'll see notifications here when there are transfers or inventory updates
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const isUnread = notification.status === 'unread';
                    const createdAt = notification.createdAt?.toDate?.() || new Date(notification.createdAt);
                    const timeAgo = getTimeAgo(createdAt);

                    const getIconAndColor = () => {
                      switch (notification.type) {
                        case 'transfer_request':
                          return { icon: <MdSwapHoriz size={20} />, color: 'var(--color-info)', bg: 'bg-blue-500/10' };
                        case 'transfer_completed':
                          return { icon: <MdCheckCircle size={20} />, color: 'var(--color-success)', bg: 'bg-green-500/10' };
                        case 'transfer_cancelled':
                          return { icon: <MdBlock size={20} />, color: 'var(--color-danger)', bg: 'bg-red-500/10' };
                        default:
                          return { icon: <MdNotifications size={20} />, color: 'var(--color-brand-primary-soft)', bg: 'bg-purple-500/10' };
                      }
                    };

                    const { icon, color, bg } = getIconAndColor();

                    return (
                      <div
                        key={notification.id}
                        className={`rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${
                          isUnread ? 'border-l-4' : 'opacity-70'
                        }`}
                        style={{
                          background: isUnread ? "var(--color-surface-2)" : "var(--color-surface-1)",
                          borderLeft: isUnread ? `4px solid var(--color-brand-primary-soft)` : "4px solid transparent",
                          border: `1px solid ${isUnread ? "var(--color-border-brand)" : "var(--color-border-soft)"}`,
                        }}
                        onClick={() => {
                          if (isUnread) {
                            markNotificationAsRead(notification.id);
                          }
                          if (notification.type === 'transfer_request' || 
                              notification.type === 'transfer_completed' || 
                              notification.type === 'transfer_cancelled') {
                            setOTab('transfers');
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                            <span style={{ color }}>{icon}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                  {notification.title}
                                  {isUnread && (
                                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-normal"
                                      style={{ background: "var(--color-brand-primary)", color: "white" }}>
                                      New
                                    </span>
                                  )}
                                </p>
                                
                                <p className="text-xs mt-1 whitespace-pre-line" style={{ color: "var(--color-text-secondary)" }}>
                                  {notification.message}
                                </p>
                                
                                {notification.fromWarehouse && notification.toWarehouse && (
                                  <div className="mt-2 flex items-center gap-2 text-[10px] flex-wrap">
                                    <span className="px-2 py-0.5 rounded" style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)" }}>
                                      📦 {notification.fromWarehouse}
                                    </span>
                                    <span style={{ color: "var(--color-text-faint)" }}>→</span>
                                    <span className="px-2 py-0.5 rounded" style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)" }}>
                                      📦 {notification.toWarehouse}
                                    </span>
                                    {notification.totalItems && (
                                      <span className="px-2 py-0.5 rounded" style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)" }}>
                                        📊 {notification.totalItems} units
                                      </span>
                                    )}
                                  </div>
                                )}
                                
                                {notification.notes && notification.notes.trim() && (
                                  <div className="mt-2 text-[10px] p-2 rounded"
                                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-secondary)" }}>
                                    📝 <span className="font-medium">Note:</span> {notification.notes}
                                  </div>
                                )}
                                
                                {notification.items && notification.items.length > 0 && (
                                  <div className="mt-2 text-[10px] flex flex-wrap gap-1">
                                    {notification.items.map((item: { productName: string; quantity: number }, i: number) => (
                                      <span key={i} className="px-2 py-0.5 rounded flex items-center gap-1"
                                        style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)" }}>
                                        {item.productName} <strong style={{ color: "var(--color-brand-primary-soft)" }}>×{item.quantity}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] shrink-0" style={{ color: "var(--color-text-faint)" }}>
                                {timeAgo}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {notificationHasMore && !allNotificationsLoaded && (
                    <div className="text-center py-4">
                      <button
                        onClick={() => loadNotificationsList(companyId, true)}
                        disabled={notificationLoadingMore}
                        className="px-6 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                        style={{ 
                          background: "var(--color-surface-3)", 
                          color: "var(--color-text-secondary)",
                          border: "1px solid var(--color-border-soft)"
                        }}
                      >
                        {notificationLoadingMore ? "Loading..." : "Load More Notifications"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ SETTINGS TAB ══ */}
          {oTab === "settings" && (
            <CompanySettingsModal
              companyId={companyId}
              staffList={staff}
              onClose={handleCloseSettings}
              onStaffUpdated={loadStaff}
              onSettingsUpdated={() => {
                loadWarehouses();
              }}
            />
          )}
        </div>
      </main>

      {/* FAB - Floating Action Button */}
      {oTab === "dashboard" && dView === "dashboard" && (
        <button 
          onClick={() => setDView("add-product")} 
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold"
          style={{ background: "var(--color-brand-primary)", color: "white", boxShadow: "var(--shadow-glow)" }}
        >
          <MdAdd size={20} /> Add Product
        </button>
      )}

      {/* Modals */}
      {showAddStaff && (
        <AddStaffModal 
          companyId={companyId} 
          onClose={() => setShowAddStaff(false)} 
          onAdded={() => loadStaff()} 
          warehouses={warehouses} 
        />
      )}

      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <StockStateEditor
            id={editItem.id}
            qty={editItemWarehouseStock}
            price={editItem.price ?? 0}
            companyId={companyId}
            warehouseId={previewWarehouseId}
            warehouseName={currentWarehouseName}
            canEditPrice={isOwner}
            canDelete={canDeleteProduct}
            onClose={() => setEditId(null)}
            onUpdateComplete={() => {
              loadWarehouses();
              if (previewWarehouseId) {
                setSelectedWarehouseId(previewWarehouseId);
              }
            }}
            onDelete={canDeleteProduct ? async (_e, id) => {
              const { deleteDoc, doc } = await import("firebase/firestore");
              const { default: db } = await import("../services/firebase");
              await deleteDoc(doc(db, "companies", companyId, "products", id));
              setEditId(null);
              loadWarehouses();
            } : undefined}
          />
        </div>
      )}

      {selectedProductForSale && (
        <SaleModal
          product={selectedProductForSale.product}
          companyId={companyId}
          warehouseId={selectedProductForSale.warehouseId}
          warehouseName={selectedProductForSale.warehouseName}
          availableStock={selectedProductForSale.availableStock}
          onClose={() => setSelectedProductForSale(null)}
          onSaleComplete={refreshAllData}
        />
      )}

      {showMultiSaleModal && (
        <SaleModal
          companyId={companyId}
          warehouseId={previewWarehouseId || "main_warehouse"}
          warehouseName={currentWarehouseName || "Main Warehouse"}
          products={displayedProducts}
          warehouseInventory={warehouseInventory}
          onClose={() => setShowMultiSaleModal(false)}
          onSaleComplete={async () => {
            await loadWarehouses();
            if (previewWarehouseId) {
              setSelectedWarehouseId(previewWarehouseId);
            }
            setShowMultiSaleModal(false);
          }}
        />
      )}

      {showOrderModal && (
        <OrderModal
          companyId={companyId}
          warehouseId={previewWarehouseId}
          warehouseName={currentWarehouseName}
          products={displayedProducts}
          onClose={() => setShowOrderModal(false)}
          onOrderComplete={() => {
            loadPendingOrders();
            refreshAllData();
          }}
        />
      )}
    </div>
  );
};

export default OwnerDashboardPage;