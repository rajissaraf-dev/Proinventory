// src/pages/ProductsPage.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MdAdd, MdShoppingCart } from "react-icons/md";
import { Product, Category, InventoryRecord, Warehouse } from "../types";
import useAppSelector from "../hooks/useAppSelector";
import useAppDispatch from "../hooks/useAppDispatch";
import useRole from "../hooks/useRole";
import { ProductService } from "../services/product.service";
import { CategoryService } from "../services/category.service";
import { InventoryService } from "../services/inventory.service";
import { WarehouseService } from "../services/warehouse.service";
import ProductSearchBar from "../components/products/ProductSearchBar";
import ProductFilters from "../components/products/ProductFilters";
import ProductTable from "../components/products/ProductTable";
import { StockStateEditor } from "../components/dashboard/StockStateEditor";
import { SaleModal } from "../components/dashboard/SaleModal";
import DashboardHeader from "../components/dashboard/DashboardHeader";
import DashboardSidebar from "../components/dashboard/DashboardSidebar";
import { toggleSidebar } from "../features/ui/uiSlice";
import useCompanySettings from "../hooks/useCompanySettings";

const ProductsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const companyId = useAppSelector((s) => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const products = useAppSelector((s) => s.stock.productData);
  const isSidebarCollapsed = useAppSelector((state) => state.ui?.sidebarCollapsed ?? false);
  const { isOwner, isAdmin, hasWarehouseScope, assignedWarehouseId } = useRole();
  const { settings } = useCompanySettings(companyId);

  // ── State ──
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [saleProduct, setSaleProduct] = useState<{
    product: Product;
    warehouseId: string;
    warehouseName: string;
    availableStock: number;
  } | null>(null);

  // ─── Multi-Sale Modal State ───
  const [showMultiSaleModal, setShowMultiSaleModal] = useState(false);

  // ─── FIX: Use proper Warehouse type instead of any[] ───
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseInventory, setWarehouseInventory] = useState<Record<string, InventoryRecord[]>>({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [whLoading, setWhLoading] = useState(true);

  // ─── EXACT SAME AS DASHBOARD ───
  const defaultPreviewWarehouseId = warehouses.find((warehouse) => warehouse.isDefault)?.id
    ?? warehouses.find((warehouse) => warehouse.id === "main_warehouse")?.id
    ?? warehouses[0]?.id
    ?? "";

  // ─── EXACT SAME AS DASHBOARD ───
  const previewWarehouseId = hasWarehouseScope && assignedWarehouseId
    ? assignedWarehouseId
    : selectedWarehouseId || defaultPreviewWarehouseId;

  // ─── EXACT SAME AS DASHBOARD's displayedProducts ───
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

  // ─── Handle multi-item sale ───
  const handleMultiSell = () => {
    if (displayedProducts.length === 0) {
      alert("No products available to sell in this warehouse.");
      return;
    }
    setShowMultiSaleModal(true);
  };

  // ─── EXACT SAME AS DASHBOARD's loadWarehouses ───
  const loadWarehouses = useCallback(async () => {
    if (!companyId) {
      setWhLoading(false);
      return;
    }
    
    setWhLoading(true);
    try {
      const list = await WarehouseService.list(companyId);

      const scopedList = list.filter((wh) => {
        if (isOwner || isAdmin) return true;
        return wh.isDefault || wh.id === 'main_warehouse' || wh.id === assignedWarehouseId;
      });
      
      const sorted = scopedList.sort((a, b) => a.name.localeCompare(b.name));
      const inventoryMap: Record<string, InventoryRecord[]> = {};
      const inventoryLists = await Promise.all(
        sorted.map((warehouse) => InventoryService.listByWarehouse(companyId, warehouse.id))
      );

      sorted.forEach((warehouse, index) => {
        inventoryMap[warehouse.id] = inventoryLists[index]
          .sort((a, b) => a.productName.localeCompare(b.productName));
      });

      setWarehouses(sorted);
      setWarehouseInventory(inventoryMap);
      
      if (previewWarehouseId && sorted.some(w => w.id === previewWarehouseId)) {
        setSelectedWarehouseId(previewWarehouseId);
      }
    } catch (error) {
      console.error("Failed to load warehouses:", error);
    } finally {
      setWhLoading(false);
    }
  }, [companyId, isOwner, isAdmin, assignedWarehouseId, previewWarehouseId]);

  // ─── Load categories ───
  useEffect(() => {
    if (!companyId) return;
    
    const loadCategories = async () => {
      try {
        const result = await CategoryService.list(companyId);
        setCategories(result);
      } catch (error) {
        console.error("Failed to load categories:", error);
      }
    };
    
    loadCategories();
    loadWarehouses();
  }, [companyId, loadWarehouses]);

  // ─── Apply filters ───
  const applyFilters = useCallback(() => {
    setIsLoading(true);

    let result = [...displayedProducts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          (p.name?.toLowerCase() || "").includes(query) ||
          (p.sku?.toLowerCase() || "").includes(query) ||
          (p.categoryName?.toLowerCase() || "").includes(query)
      );
    }

    // Category filter
    if (selectedCategory) {
      result = result.filter((p) => p.categoryId === selectedCategory);
    }

    // Status filter
    if (selectedStatus) {
      const threshold = settings.lowStockThreshold || 10;
      const getStockQty = (p: Product) => p.product_Qty ?? p.stockQuantity ?? 0;
      
      switch (selectedStatus) {
        case "in_stock":
          result = result.filter((p) => getStockQty(p) > threshold);
          break;
        case "low_stock":
          result = result.filter((p) => getStockQty(p) > 0 && getStockQty(p) <= threshold);
          break;
        case "out_of_stock":
          result = result.filter((p) => getStockQty(p) === 0);
          break;
        default:
          break;
      }
    }

    setFilteredProducts(result);
    setIsLoading(false);
  }, [displayedProducts, searchQuery, selectedCategory, selectedStatus, settings.lowStockThreshold]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // ── Handlers ──
  const handleSearch = (query: string) => setSearchQuery(query);
  const handleCategoryChange = (categoryId: string) => setSelectedCategory(categoryId);
  const handleStatusChange = (status: string) => setSelectedStatus(status);
  const handleEdit = (product: Product) => setEditProduct(product);

  const handleDelete = async (productId: string) => {
    if (!companyId) return;
    try {
      await ProductService.delete(companyId, productId);
      await loadWarehouses();
      applyFilters();
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Failed to delete product. Please try again.");
    }
  };

  // ProductsPage.tsx - Fix handleSell

// ProductsPage.tsx - handleSell

const handleSell = (product: Product) => {
  // ─── FIX: Get stock from the product's product_Qty (which has warehouse stock) ───
  const stockQty = product.product_Qty ?? product.stockQuantity ?? 0;
  
  console.log(`🛒 [ProductsPage] Selling: ${product.name}, Stock: ${stockQty}`);
  console.log(`🛒 [ProductsPage] Product data:`, product);
  
  if (stockQty <= 0) {
    alert(`This product "${product.name}" is out of stock.`);
    return;
  }

  const warehouseId = previewWarehouseId || "main_warehouse";
  const warehouseName = warehouses.find(w => w.id === warehouseId)?.name || warehouseId;

  // ─── Ensure the product has the correct stock before passing ───
  const productWithStock = {
    ...product,
    product_Qty: stockQty,
    stockQuantity: stockQty,
  };

  setSaleProduct({
    product: productWithStock,
    warehouseId,
    warehouseName,
    availableStock: stockQty,
  });
  
  console.log(`🛒 [ProductsPage] Setting saleProduct with availableStock: ${stockQty}`);
};
  const handleAddProduct = () => navigate("/owner?view=add-product");
  
  const handleEditComplete = async () => {
    setEditProduct(null);
    await loadWarehouses();
    applyFilters();
  };

  const handleSaleComplete = async () => {
    setSaleProduct(null);
    await loadWarehouses();
    applyFilters();
  };

  const handleMultiSaleComplete = async () => {
    setShowMultiSaleModal(false);
    await loadWarehouses();
    applyFilters();
  };

  const canEdit = isOwner || isAdmin;
  const handleToggleSidebar = () => dispatch(toggleSidebar());

  // ─── Get warehouse name for display ───
  const warehouseDisplayName = warehouses.find(w => w.id === previewWarehouseId)?.name || previewWarehouseId || "All Warehouses";

  if (whLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg-app)" }}>
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "var(--color-brand-primary)" }} />
          <p className="text-sm mt-4" style={{ color: "var(--color-text-muted)" }}>Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-bg-app)" }}>
      {/* Sidebar */}
      <DashboardSidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        activeView="dashboard"
        onAlertsClick={() => navigate("/dashboard?tab=notifications")}
      />

      {/* Right column — header + content stacked */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Sticky header — works correctly inside RootLayout's scroll container */}
        <div style={{ position: "relative" }}>
          <DashboardHeader
            sticky
            onMenuClick={handleToggleSidebar}
            isSidebarCollapsed={isSidebarCollapsed}
            onNotificationClick={() => navigate("/dashboard?tab=notifications")}
          />
        </div>

        {/* Page content — no pt-14 needed, header is in flow */}
        <main className="flex-1 px-4 sm:px-5 pt-3 pb-6" style={{ background: "var(--color-bg-app)" }}>

          {/* ── Single compact toolbar row ── */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {/* Title */}
            <div className="mr-2">
              <h1 className="text-base font-bold leading-none" style={{ color: "var(--color-text-primary)" }}>
                Products
                {previewWarehouseId && (
                  <span className="text-xs font-normal ml-1.5" style={{ color: "var(--color-text-muted)" }}>
                    — {warehouseDisplayName}
                  </span>
                )}
              </h1>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                {filteredProducts.length} product{filteredProducts.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Search — flex-1 to take remaining space */}
            <ProductSearchBar onSearch={handleSearch} className="flex-1 min-w-[180px]" />

            {/* Filters */}
            <ProductFilters
              categories={categories}
              selectedCategory={selectedCategory}
              selectedStatus={selectedStatus}
              onCategoryChange={handleCategoryChange}
              onStatusChange={handleStatusChange}
            />

            {/* Actions */}
            {canEdit && (
              <>
                <button
                  onClick={handleMultiSell}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80 shrink-0"
                  style={{ background: "var(--color-surface-2)", color: "var(--color-brand-primary)", border: "1px solid var(--color-border-brand)" }}
                >
                  <MdShoppingCart size={14} /> Multi-Sell
                </button>
                <button
                  onClick={handleAddProduct}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all hover:opacity-80 shrink-0"
                  style={{ background: "var(--color-brand-primary)", color: "white" }}
                >
                  <MdAdd size={14} /> Add Product
                </button>
              </>
            )}
          </div>

          {/* ── Warehouse scope notice — only when scoped, compact inline bar ── */}
          {previewWarehouseId && (
            <div
              className="mb-2 px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-2"
              style={{ background: "var(--color-info-soft)", border: "1px solid var(--color-info-border)" }}
            >
              <span style={{ color: "var(--color-info)" }}>🔒</span>
              <span style={{ color: "var(--color-text-secondary)" }}>
                Viewing <strong style={{ color: "var(--color-text-primary)" }}>{warehouseDisplayName}</strong>
                {displayedProducts.length === 0 && " — No products found."}
              </span>
              {displayedProducts.length > 0 && (
                <span className="ml-auto text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                  {displayedProducts.length} item{displayedProducts.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* ── Product Table ── */}
          <ProductTable
            products={filteredProducts}
            isLoading={isLoading}
            isOwner={isOwner}
            isAdmin={isAdmin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onSell={handleSell}
            onMultiSell={handleMultiSell}
            onAdd={handleAddProduct}
            warehouseName={previewWarehouseId || undefined}
          />
        </main>
      </div>

      {/* ── Modals render outside the column layout ── */}
      {editProduct && (
        <StockStateEditor
          id={editProduct.id}
          qty={editProduct.product_Qty ?? editProduct.stockQuantity ?? 0}
          price={editProduct.price ?? editProduct.product_Price ?? 0}
          companyId={companyId}
          warehouseId={previewWarehouseId || "main_warehouse"}
          warehouseName={warehouseDisplayName || "Main Warehouse"}
          canEditPrice={canEdit}
          canDelete={canEdit}
          onClose={() => setEditProduct(null)}
          onUpdateComplete={handleEditComplete}
          onDelete={canEdit ? async (_e, id) => {
            await ProductService.delete(companyId, id);
            setEditProduct(null);
            await loadWarehouses();
            applyFilters();
          } : undefined}
        />
      )}

      {/* ── Single Product Sale Modal ── */}
      {saleProduct && (
        <SaleModal
          product={saleProduct.product}
          companyId={companyId}
          warehouseId={saleProduct.warehouseId}
          warehouseName={saleProduct.warehouseName}
          availableStock={saleProduct.availableStock}
          onClose={() => setSaleProduct(null)}
          onSaleComplete={handleSaleComplete}
        />
      )}

      {/* ── Multi-Item Sale Modal ── */}
      {showMultiSaleModal && (
        <SaleModal
          companyId={companyId}
          warehouseId={previewWarehouseId || "main_warehouse"}
          warehouseName={warehouseDisplayName || "Main Warehouse"}
          products={displayedProducts}
          warehouseInventory={warehouseInventory}
          onClose={() => setShowMultiSaleModal(false)}
          onSaleComplete={handleMultiSaleComplete}
        />
      )}
    </div>
  );
};

export default ProductsPage;