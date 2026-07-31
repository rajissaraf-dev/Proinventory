// src/components/dashboard/AddProductView.tsx

import { useState, useRef, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import imageCompression from "browser-image-compression";
import { MdImage, MdSave, MdCloudUpload } from "react-icons/md";
import { FiChevronRight, FiTag, FiPackage, FiShield, FiDollarSign } from "react-icons/fi";
import { useAuth } from "../../services/firebase";
import { RootState } from "../../app/store";
import { ProductService } from "../../services/product.service";
import { CategoryService } from "../../services/category.service";
import { WarehouseService } from "../../services/warehouse.service";
import { uploadImageToCloudinary } from "../../services/cloudinary.service";
import useRole from "../../hooks/useRole";
import { Category, Warehouse } from "../../types";

interface AddProductViewProps {
  onCancel: () => void;
  onSaved: () => void;
}

// ─── Currency Configuration ───
interface CurrencyConfig {
  symbol: string;
  code: string;
  locale: string;
}

const CURRENCIES: Record<string, CurrencyConfig> = {
  NGN: { symbol: "₦", code: "NGN", locale: "en-NG" },
  USD: { symbol: "$", code: "USD", locale: "en-US" },
  EUR: { symbol: "€", code: "EUR", locale: "de-DE" },
  GBP: { symbol: "£", code: "GBP", locale: "en-GB" },
  GHS: { symbol: "₵", code: "GHS", locale: "en-GH" },
  KES: { symbol: "KSh", code: "KES", locale: "en-KE" },
  ZAR: { symbol: "R", code: "ZAR", locale: "en-ZA" },
  JPY: { symbol: "¥", code: "JPY", locale: "ja-JP" },
  CNY: { symbol: "¥", code: "CNY", locale: "zh-CN" },
  INR: { symbol: "₹", code: "INR", locale: "en-IN" },
  AUD: { symbol: "A$", code: "AUD", locale: "en-AU" },
  CAD: { symbol: "C$", code: "CAD", locale: "en-CA" },
};

const DEFAULT_CURRENCY = CURRENCIES.NGN;

// ─── Currency options for dropdown ───
const CURRENCY_OPTIONS = Object.values(CURRENCIES).sort((a, b) => a.code.localeCompare(b.code));

const TIPS = [
  { icon: <MdImage size={20} />, iconBg: "var(--color-nav-active-bg)", iconColor: "var(--color-brand-primary-soft)", title: "High Quality Images", desc: "Use clear, high-resolution images for better visibility." },
  { icon: <FiShield size={18} />, iconBg: "var(--color-stock-in-soft)", iconColor: "var(--color-stock-in)", title: "Accurate Information", desc: "Provide accurate details to avoid inventory issues." },
  { icon: <FiTag size={18} />, iconBg: "var(--color-warning-soft)", iconColor: "var(--color-warning)", title: "Right Category", desc: "Select the right category to improve organisation." },
  { icon: <FiDollarSign size={18} />, iconBg: "var(--color-info-soft)", iconColor: "var(--color-info)", title: "Competitive Pricing", desc: "Set the right price to stay competitive in the market." },
];

const INPUT_STYLE = {
  background: "var(--color-input-bg)",
  border: "1px solid var(--color-input-border)",
  color: "var(--color-input-text)",
  outline: "none",
};

const AddProductView = ({ onCancel, onSaved }: AddProductViewProps) => {
  const currentUser = useAuth();
  const { assignedWarehouseId, hasWarehouseScope } = useRole();
  const companyId = useSelector((s: RootState) => s.auth.user?.companyId ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(false);
  const [productName, setProductName] = useState("");
  const [category, setCategory]       = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyConfig>(DEFAULT_CURRENCY);
  const [price, setPrice]             = useState("");
  const [qty, setQty]                 = useState("");
  const [size, setSize]               = useState("");
  const [description, setDescription] = useState("");
  const [imgPreview, setImgPreview]   = useState<string | null>(null);
  const [imgUrl, setImgUrl]           = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError]             = useState("");
  const [saving, setSaving]           = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(true);

  const scopedWarehouses = hasWarehouseScope && assignedWarehouseId
    ? warehouses.filter((warehouse) => warehouse.id === assignedWarehouseId)
    : warehouses;

 // ─── Load currency from settings ───
// ─── Load currency from settings ───
  const loadCurrency = useCallback(async (activeCompanyId: string) => {
    if (!activeCompanyId) {
      setSelectedCurrency(CURRENCIES.NGN);
      setCurrencyLoading(false);
      return;
    }

    setCurrencyLoading(true);
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { default: db } = await import("../../services/firebase");
      
      const settingsRef = doc(db, "companies", activeCompanyId, "settings", "general");
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        const code = (settings.currency || "NGN").toUpperCase().trim();
        const currency = CURRENCIES[code] || CURRENCIES.NGN;
        
        setSelectedCurrency(currency);
        console.log(`💰 Currency successfully loaded: ${currency.symbol} (${currency.code})`);
      } else {
        console.warn("⚠️ Document 'companies/" + activeCompanyId + "/settings/general' not found. Defaulting to NGN.");
        setSelectedCurrency(CURRENCIES.NGN);
      }
    } catch (err) {
      console.error("Failed to load currency settings, defaulting to NGN:", err);
      setSelectedCurrency(CURRENCIES.NGN);
    } finally {
      setCurrencyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      // If companyId isn't loaded from Redux yet, keep waiting
      return;
    }

    let cancelled = false;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const list = await CategoryService.list(companyId);
        if (cancelled) return;
        setCategories(list.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to load categories.");
      } finally {
        if (!cancelled) setCategoriesLoading(false);
      }
    };

    const loadWarehouses = async () => {
      setWarehousesLoading(true);
      try {
        const list = await WarehouseService.list(companyId);
        if (cancelled) return;
        const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(sorted);

        const defaultWarehouseId = hasWarehouseScope && assignedWarehouseId
          ? assignedWarehouseId
          : sorted[0]?.id || "";

        setWarehouseId((current) => current || defaultWarehouseId);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to load warehouses.");
      } finally {
        if (!cancelled) setWarehousesLoading(false);
      }
    };

    void loadCategories();
    void loadWarehouses();
    void loadCurrency(companyId);

    return () => {
      cancelled = true;
    };
  }, [companyId, assignedWarehouseId, hasWarehouseScope, loadCurrency]);
  // ─── Handle currency change ───
  const handleCurrencyChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const currency = CURRENCIES[code] || DEFAULT_CURRENCY;
    setSelectedCurrency(currency);
    console.log(`💰 Currency changed to: ${currency.symbol} (${currency.code})`);
    
    // ─── Save currency preference ───
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { default: db } = await import("../../services/firebase");
      const settingsRef = doc(db, "companies", companyId, "settings", "general");
      await updateDoc(settingsRef, {
        currency: currency.code,
        currencySymbol: currency.symbol,
        updatedAt: new Date(),
      });
      console.log(`✅ Currency saved to settings: ${currency.code}`);
    } catch (err) {
      console.warn("Failed to save currency preference:", err);
    }
  };

  /* ── File picker handler ── */
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
      setError("Only JPG, PNG or WEBP images allowed."); return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setError("Max file size is 5 MB."); return;
    }
    setError("");
    const compressed = f.size > 1_048_576
      ? await imageCompression(f, { maxSizeMB: 1, maxWidthOrHeight: 1200 })
      : f;

    setImgPreview(URL.createObjectURL(compressed));
    setUploadProgress(0);

    try {
      const url = await uploadImageToCloudinary(compressed, "products");
      setImgUrl(url);
      setUploadProgress(100);
    } catch (err) {
      setError((err as Error).message);
      setUploadProgress(null);
    }
  };

  /* ── Drag & drop ── */
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(f);
        input.files = dt.files;
        const changeEvent = new Event('change', { bubbles: true });
        input.dispatchEvent(changeEvent);
        handleFilePick({ target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!productName.trim()) { setError("Product name is required."); return; }
    if (!category)           { setError("Please select a category."); return; }
    if (!price)              { setError("Price is required."); return; }
    if (!qty)                { setError("Quantity is required."); return; }
    if (!size)               { setError("Packaging size is required."); return; }
    if (!companyId)          { setError("Company context is not available yet."); return; }
    if (!warehouseId)        { setError("Please select a warehouse for this product."); return; }

    const selectedCategory = categories.find((item) => item.id === category);
    const selectedWarehouse = warehouses.find((item) => item.id === warehouseId);

    if (!selectedCategory) {
      setError("Selected category is no longer available. Please choose another category.");
      return;
    }

    if (!selectedWarehouse) {
      setError("Selected warehouse is no longer available. Please choose another warehouse.");
      return;
    }

    setSaving(true);
    try {
      await ProductService.create({
        companyId,
        createdBy: currentUser?.uid ?? "",
        name: productName.trim(),
        sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        price: Number(price),
        stockQuantity: Number(qty),
        imageUrl: imgUrl ?? "",
        size,
        warehouseId: selectedWarehouse.id,
        warehouseName: selectedWarehouse.name,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /* ── Input shared class ── */
  const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm transition-all";

  if (currencyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: "var(--color-brand-primary)" }} />
          <p className="text-sm mt-3" style={{ color: "var(--color-text-muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">

      {/* ── Page header ── */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        {/* Breadcrumb */}
        <div>
          <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: "var(--color-text-faint)" }}>
            <span
              className="cursor-pointer transition-colors hover:underline"
              style={{ color: "var(--color-brand-primary-soft)" }}
              onClick={onCancel}
            >
              Products
            </span>
            <FiChevronRight size={12} />
            <span style={{ color: "var(--color-text-muted)" }}>Add New Product</span>
          </div>
          <h1
            className="text-xl font-extrabold tracking-tight"
            style={{ color: "var(--color-text-primary)" }}
          >
            Add New Product
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            Fill in the product details below to add it to your inventory.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "transparent",
              color: "var(--color-text-secondary)",
              border: "1px solid var(--color-border-medium)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-strong)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-medium)")}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (uploadProgress !== null && uploadProgress < 100)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              background: "var(--color-brand-primary)",
              color: "white",
              boxShadow: "var(--shadow-glow)",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-brand-primary-hover)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-brand-primary)")}
          >
            <MdSave size={16} />
            {saving ? "Saving…" : "Save Product"}
          </button>
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{
              background: "var(--color-danger-soft)",
              border: "1px solid var(--color-danger-border)",
              color: "var(--color-danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Main card ── */}
        <div
          className="rounded-2xl p-6 mb-6"
          style={{
            background: "var(--color-surface-1)",
            border: "1px solid var(--color-border-soft)",
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* ── LEFT: Product info ── */}
            <div className="flex flex-col gap-5">
              {/* Section label */}
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--color-nav-active-bg)", border: "1px solid var(--color-border-brand)" }}
                >
                  <FiPackage size={16} style={{ color: "var(--color-brand-primary-soft)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Product Information
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Basic details about the product.
                  </p>
                </div>
              </div>

              {/* Product Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Product Name
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <FiPackage size={14} style={{ color: "var(--color-input-icon)" }} />
                  </span>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    maxLength={100}
                    placeholder="Enter product name"
                    className={`${inputCls} pl-9 pr-16`}
                    style={INPUT_STYLE}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {productName.length}/100
                  </span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Product Category
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <FiTag size={14} style={{ color: "var(--color-input-icon)" }} />
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`${inputCls} pl-9 appearance-none`}
                    style={{ ...INPUT_STYLE, paddingRight: "2.5rem" }}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                    disabled={categoriesLoading || categories.length === 0}
                  >
                    <option value="" disabled>
                      {categoriesLoading ? "Loading categories..." : categories.length === 0 ? "Create a category first" : "Select category"}
                    </option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-input-icon)" }}>▾</span>
                </div>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Warehouse
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2">
                    <MdImage size={14} style={{ color: "var(--color-input-icon)" }} />
                  </span>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className={`${inputCls} pl-9 appearance-none`}
                    style={{ ...INPUT_STYLE, paddingRight: "2.5rem" }}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                    disabled={warehousesLoading || warehouses.length === 0 || (hasWarehouseScope && !!assignedWarehouseId)}
                  >
                    <option value="" disabled>
                      {warehousesLoading ? "Loading warehouses..." : warehouses.length === 0 ? "Create a warehouse first" : "Select warehouse"}
                    </option>
                    {scopedWarehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.code} — {warehouse.name}</option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-input-icon)" }}>▾</span>
                </div>
              </div>

              {/* ─── FIXED: Price with Currency Selection ─── */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                  Price <span style={{ color: "var(--color-danger)" }}>*</span>
                </label>
                <div className="flex gap-2">
                  {/* ─── Currency Selector Dropdown ─── */}
                  <select
                    value={selectedCurrency.code}
                    onChange={handleCurrencyChange}
                    className="rounded-lg px-3 py-2.5 text-sm w-28 shrink-0 appearance-none font-medium cursor-pointer"
                    style={{
                      ...INPUT_STYLE,
                      background: "var(--color-surface-3)",
                      paddingRight: "2rem",
                      borderColor: "var(--color-border-medium)",
                    }}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-brand)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-medium)")}
                  >
                    {CURRENCY_OPTIONS.map((curr) => (
                      <option key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.code}
                      </option>
                    ))}
                  </select>

                  {/* ─── Price Input with Dynamic Symbol ─── */}
                  <div className="relative flex-1">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                      style={{ color: "var(--color-input-icon)" }}
                    >
                      {selectedCurrency.symbol}
                    </span>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={`Enter price in ${selectedCurrency.code}`}
                      min={0}
                      step="0.01"
                      className={`${inputCls} pl-7`}
                      style={INPUT_STYLE}
                      onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                      onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                    />
                  </div>
                </div>
                {/* ─── Price Preview with Currency ─── */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                    {price && Number(price) > 0 
                      ? `${selectedCurrency.symbol}${Number(price).toFixed(2)} ${selectedCurrency.code}`
                      : `Enter price in ${selectedCurrency.code}`}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded flex items-center gap-1" 
                    style={{ background: "var(--color-surface-3)", color: "var(--color-text-faint)" }}>
                    <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      {selectedCurrency.symbol}
                    </span>
                    {selectedCurrency.code}
                  </span>
                </div>
              </div>

              {/* Qty + Size row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                    Quantity
                  </label>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder="0"
                    min={0}
                    className={inputCls}
                    style={INPUT_STYLE}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--color-text-secondary)" }}>
                    Packaging Size
                  </label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className={`${inputCls} appearance-none`}
                    style={INPUT_STYLE}
                  >
                    <option value="" disabled>Select</option>
                    {["Pack", "Carton", "Piece", "Sachet", "Bag", "Box", "Bottle"].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Additional details */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--color-surface-3)", border: "1px solid var(--color-border-soft)" }}
                  >
                    <FiTag size={14} style={{ color: "var(--color-text-muted)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                      Additional Details <span style={{ color: "var(--color-text-faint)", fontWeight: 400 }}>(Optional)</span>
                    </p>
                    <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                      Add more information about the product.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-3">
                    <FiTag size={13} style={{ color: "var(--color-input-icon)" }} />
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    placeholder="Enter description, specifications, or other details…"
                    rows={4}
                    className="w-full rounded-lg px-3 py-2.5 pl-9 text-sm resize-none transition-all"
                    style={INPUT_STYLE}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                  />
                  <span
                    className="absolute right-3 bottom-2.5 text-xs"
                    style={{ color: "var(--color-text-faint)" }}
                  >
                    {description.length}/500
                  </span>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Image upload ── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "var(--color-nav-active-bg)", border: "1px solid var(--color-border-brand)" }}
                >
                  <MdImage size={16} style={{ color: "var(--color-brand-primary-soft)" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    Product Image
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                    Upload a high-quality image of your product.
                  </p>
                </div>
              </div>

              {/* Drop zone */}
              <div
                className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 px-6 cursor-pointer transition-all"
                style={{ borderColor: "var(--color-border-brand)", background: "var(--color-surface-2)" }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-brand-strong)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-border-brand)")}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "var(--color-nav-active-bg)" }}
                >
                  <MdCloudUpload size={32} style={{ color: "var(--color-brand-primary-soft)" }} />
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                  Drag &amp; drop your image here
                </p>
                <p className="text-xs mb-4" style={{ color: "var(--color-brand-primary-soft)" }}>
                  or click to browse
                </p>

                {/* Upload progress */}
                {uploadProgress !== null && (
                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden mb-3"
                    style={{ background: "var(--color-surface-4)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(uploadProgress, 5)}%`, background: "var(--color-brand-primary)" }}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="px-6 py-2 rounded-lg text-sm font-semibold w-full transition-all"
                  style={{
                    background: "var(--color-surface-3)",
                    color: "var(--color-text-primary)",
                    border: "1px solid var(--color-border-medium)",
                  }}
                >
                  Choose File
                </button>
                <p className="mt-3 text-xs" style={{ color: "var(--color-text-faint)" }}>
                  JPG, PNG or WEBP. Max size 5MB.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFilePick}
                />
              </div>

              {/* Image preview */}
              <div
                className="rounded-xl p-4"
                style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-soft)" }}
              >
                <p className="text-xs font-medium mb-2" style={{ color: "var(--color-text-secondary)" }}>
                  Image Preview
                </p>
                {imgPreview ? (
                  <div className="relative">
                    <img
                      src={imgPreview}
                      alt="Preview"
                      className="w-full rounded-lg object-cover"
                      style={{ maxHeight: "180px" }}
                    />
                    {imgUrl && (
                      <div
                        className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "var(--color-stock-in-soft)", color: "var(--color-stock-in)" }}
                      >
                        ✓ Uploaded
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex flex-col items-center justify-center rounded-lg py-8"
                    style={{ background: "var(--color-surface-3)" }}
                  >
                    <MdImage size={28} style={{ color: "var(--color-text-faint)" }} />
                    <p className="text-xs mt-2" style={{ color: "var(--color-text-faint)" }}>
                      Your uploaded image will appear here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Tips row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIPS.map(({ icon, iconBg, iconColor, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 p-4 rounded-xl"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: iconBg }}
              >
                <span style={{ color: iconColor }}>{icon}</span>
              </div>
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--color-text-primary)" }}>
                  {title}
                </p>
                <p className="text-xs leading-snug" style={{ color: "var(--color-text-muted)" }}>
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AddProductView;