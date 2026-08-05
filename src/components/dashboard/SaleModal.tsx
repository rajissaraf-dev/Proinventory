// src/components/dashboard/SaleModal.tsx

import { useState, useEffect } from "react";
import useAppSelector from "../../hooks/useAppSelector";
import useCompanySettings from "../../hooks/useCompanySettings";
import { formatCurrency } from "../../lib/companySettings";
import { 
  MdClose, MdShoppingCart, MdWarehouse, 
  MdAdd, MdDelete, MdRemove, MdAddCircle, MdReceipt,
  MdPerson, MdEmail, MdNote, MdPayment, MdPercent
} from "react-icons/md";
import { Product, InventoryRecord } from "../../types";

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  price: number;
  maxStock: number;
  product: Product;
}

// ─── Define type for warehouse inventory ───
interface WarehouseInventory {
  [warehouseId: string]: InventoryRecord[];
}

interface SaleModalProps {
  product?: Product;
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  availableStock?: number;
  onClose: () => void;
  onSaleComplete: () => void;
  products?: Product[];
  warehouseInventory?: WarehouseInventory; // ← FIXED: Proper type
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  notes: string;
}

interface PaymentInfo {
  method: 'cash' | 'card' | 'transfer' | 'bank_deposit';
  discount: number;
  tax: number;
}

const S: React.CSSProperties = {
  background: "var(--color-input-bg)",
  border: "1px solid var(--color-input-border)",
  color: "var(--color-input-text)",
  borderRadius: "0.75rem",
  padding: "0.625rem 0.875rem",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
};

const S_SELECT: React.CSSProperties = {
  ...S,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
  paddingRight: "2.5rem",
};

export const SaleModal = ({ 
  product: initialProduct,
  companyId, 
  warehouseId: defaultWarehouseId,
  warehouseName: defaultWarehouseName,
  availableStock: initialAvailableStock,
  onClose, 
  onSaleComplete,
  products: allProducts = [],
  warehouseInventory = {},
}: SaleModalProps) => {
  // ─── State ───
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  // ─── REMOVED: unused selectedWarehouseId ───
  const [quantity, setQuantity] = useState<number>(1);
  const [customer, setCustomer] = useState<CustomerInfo>({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [payment, setPayment] = useState<PaymentInfo>({
    method: 'cash',
    discount: 0,
    tax: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMultiProduct, setIsMultiProduct] = useState(false);

  const currentUser = useAppSelector((s) => s.auth.user);
  const currentUserId = currentUser?.uid ?? "";
  const { settings } = useCompanySettings(companyId);
  const currencySymbol = settings.currencySymbol || "$";
  const currencyCode = settings.currency || "USD";
  const formatMoney = (value: number) => formatCurrency(value, currencySymbol, currencyCode);

  // ─── Get available products for the warehouse ───
  const getAvailableProducts = (): Product[] => {
    if (allProducts.length > 0) {
      return allProducts;
    }
    if (initialProduct) {
      return [initialProduct];
    }
    return [];
  };

  const availableProducts = getAvailableProducts();

  // ─── Get stock for a product in a warehouse ───
  // NOTE: warehouseInventory is only populated in multi-product mode.
  // In single-product mode it's an empty object ({}), so we must fall back
  // to the value already captured on the cart item (maxStock), which was
  // itself correctly derived from `initialAvailableStock` when added.
  // Without this fallback, single-product sales always read stock as 0.
  const getProductStock = (productId: string, warehouseId: string): number => {
    const inventory = warehouseInventory[warehouseId];
    if (inventory && inventory.length > 0) {
      const found = inventory.find((i: InventoryRecord) => i.productId === productId);
      if (found) return found.quantity ?? 0;
    }

    const cartItem = cartItems.find(
      (c) => c.productId === productId && c.warehouseId === warehouseId
    );
    if (cartItem) return cartItem.maxStock;

    return 0;
  };

  // ─── Get product details ───
  const getProductDetails = (productId: string): Product | undefined => {
    return availableProducts.find(p => p.id === productId);
  };

// ─── Initialize with single product if provided ───
// SaleModal.tsx - Updated useEffect

// ─── Initialize with single product if provided ───
useEffect(() => {
  if (initialProduct && !isMultiProduct) {
    // ─── FIX: Use initialAvailableStock directly, NO FALLBACK ───
    const stock = initialAvailableStock ?? 0;
    
    console.log(`📦 [SaleModal] Initializing single product: ${initialProduct.name}`);
    console.log(`📦 [SaleModal] Available stock from prop: ${stock}`);
    
    if (stock > 0) {
      setCartItems([{
        productId: initialProduct.id,
        productName: initialProduct.name || initialProduct.product_name || "",
        sku: initialProduct.sku || "",
        warehouseId: defaultWarehouseId,
        warehouseName: defaultWarehouseName,
        quantity: 1,
        price: initialProduct.price || initialProduct.product_Price || 0,
        maxStock: stock,
        product: initialProduct,
      }]);
      setError(null);
    } else {
      setCartItems([]);
      setError(`This product is out of stock.`);
    }
  }
}, [initialProduct, defaultWarehouseId, defaultWarehouseName, initialAvailableStock, isMultiProduct]);

  // ─── Check if we should show multi-product mode ───
  useEffect(() => {
    if (availableProducts.length > 1 || !initialProduct) {
      setIsMultiProduct(true);
    }
  }, [availableProducts.length, initialProduct]);

  // ─── Add item to cart ───
  const addToCart = () => {
    if (!selectedProductId) {
      setError("Please select a product");
      return;
    }

    const product = getProductDetails(selectedProductId);
    if (!product) {
      setError("Product not found");
      return;
    }

    const stock = getProductStock(selectedProductId, defaultWarehouseId);
    if (stock <= 0) {
      setError("This product is out of stock in the selected warehouse");
      return;
    }

    const existingItem = cartItems.find(
      item => item.productId === selectedProductId && item.warehouseId === defaultWarehouseId
    );

    const qtyToAdd = Math.min(quantity, stock);
    if (qtyToAdd <= 0) {
      setError("Quantity must be greater than 0");
      return;
    }

    if (existingItem) {
      const newQty = Math.min(existingItem.quantity + qtyToAdd, existingItem.maxStock);
      setCartItems(items => items.map(item =>
        item.productId === selectedProductId && item.warehouseId === defaultWarehouseId
          ? { ...item, quantity: newQty }
          : item
      ));
    } else {
      setCartItems(items => [...items, {
        productId: product.id,
        productName: product.name || product.product_name || "",
        sku: product.sku || "",
        warehouseId: defaultWarehouseId,
        warehouseName: defaultWarehouseName,
        quantity: qtyToAdd,
        price: product.price || product.product_Price || 0,
        maxStock: stock,
        product,
      }]);
    }

    setSelectedProductId("");
    setQuantity(1);
    setError(null);
  };

  // ─── Remove item from cart ───
  const removeFromCart = (index: number) => {
    setCartItems(items => items.filter((_, i) => i !== index));
  };

  // ─── Update item quantity ───
  const updateQuantity = (index: number, newQuantity: number) => {
    const item = cartItems[index];
    if (!item) return;
    const clamped = Math.max(1, Math.min(newQuantity, item.maxStock));
    setCartItems(items => items.map((it, i) =>
      i === index ? { ...it, quantity: clamped } : it
    ));
  };

  // ─── Calculate totals ───
  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const discountAmount = (subtotal * (payment.discount || 0)) / 100;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * (payment.tax || 0)) / 100;
    const total = taxableAmount + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const { subtotal, discountAmount, taxAmount, total } = calculateTotals();

  // ─── Submit sale ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (cartItems.length === 0) {
      setError("Please add at least one product to the cart");
      return;
    }

    for (const item of cartItems) {
      const currentStock = getProductStock(item.productId, item.warehouseId);
      if (currentStock < item.quantity) {
        setError(`Not enough stock for "${item.productName}". Available: ${currentStock}, Requested: ${item.quantity}`);
        return;
      }
    }

    setLoading(true);
    try {
      const { SalesService } = await import("../../services/sales.service");

      for (const item of cartItems) {
        const itemTotal = item.quantity * item.price;
        const itemDiscount = (itemTotal * (payment.discount || 0)) / 100;
        const itemTax = ((itemTotal - itemDiscount) * (payment.tax || 0)) / 100;
        const itemFinalTotal = itemTotal - itemDiscount + itemTax;

        await SalesService.recordSale({
          companyId,
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          warehouseId: item.warehouseId,
          warehouseName: item.warehouseName,
          quantity: item.quantity,
          price: item.price,
          totalAmount: itemFinalTotal,
          customerName: customer.name || undefined,
          customerEmail: customer.email || undefined,
          notes: customer.notes || `Multi-item sale with ${cartItems.length} items`,
          paymentMethod: payment.method,
          discount: payment.discount || 0,
          tax: payment.tax || 0,
          createdBy: currentUserId || "system",
        });

        SalesService.notifyInventoryChange({
          companyId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          newQuantity: item.maxStock - item.quantity,
          oldQuantity: item.maxStock,
        });
      }

      console.log(`✅ Multi-item sale completed: ${cartItems.length} items sold`);

      onSaleComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render cart item ───
  const renderCartItem = (item: CartItem, index: number) => {
    const itemTotal = item.quantity * item.price;
    return (
      <div
        key={`${item.productId}-${item.warehouseId}-${index}`}
        className="flex items-center gap-3 p-2 rounded-lg"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
            {item.productName}
          </p>
          <div className="flex items-center gap-2 text-[10px]">
            <span style={{ color: "var(--color-text-faint)" }}>SKU: {item.sku}</span>
            <span style={{ color: "var(--color-text-faint)" }}>|</span>
            <span style={{ color: "var(--color-text-faint)" }}>Stock: {item.maxStock}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => updateQuantity(index, item.quantity - 1)}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "var(--color-text-muted)" }}
            disabled={item.quantity <= 1}
          >
            <MdRemove size={14} />
          </button>
          <span className="text-sm font-semibold w-8 text-center" style={{ color: "var(--color-text-primary)" }}>
            {item.quantity}
          </span>
          <button
            type="button"
            onClick={() => updateQuantity(index, item.quantity + 1)}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: "var(--color-text-muted)" }}
            disabled={item.quantity >= item.maxStock}
          >
            <MdAdd size={14} />
          </button>
        </div>
        <div className="text-right min-w-[70px]">
          <p className="text-xs font-semibold" style={{ color: "var(--color-brand-primary-soft)" }}>
            {formatMoney(itemTotal)}
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
            @ {formatMoney(item.price)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => removeFromCart(index)}
          className="w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-red-500/20"
          style={{ color: "var(--color-danger)" }}
        >
          <MdDelete size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 ">
 
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[95vh] overflow-y-auto scrollbar-hide"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-brand)", boxShadow: "var(--shadow-card)",
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
  }}
        >
             <style>{`
      .modal-scroll::-webkit-scrollbar {
        display: none;
      }
    `}</style>
        
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white">
              <MdShoppingCart size={20} style={{ color: "var(--color-brand-primary)" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {isMultiProduct ? "Multi-Item Sale" : "Record Sale"}
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {isMultiProduct ? "Add products to cart and complete sale" : "Complete sale for selected product"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/10"
            style={{ color: "var(--color-text-muted)" }}
          >
            <MdClose size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Warehouse Info ─── */}
          <div className="rounded-lg p-3 text-xs flex items-center gap-2"
            style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
            <MdWarehouse size={14} style={{ color: "var(--color-brand-primary-soft)" }} />
            <span style={{ color: "var(--color-text-secondary)" }}>
              Selling from: <strong style={{ color: "var(--color-text-primary)" }}>{defaultWarehouseName}</strong>
            </span>
          </div>

          {/* ─── Add Products Section (Multi-product) ─── */}
          {isMultiProduct && (
            <div className="rounded-lg p-3 space-y-3"
              style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                Add Products to Cart
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[150px]">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    style={S_SELECT}
                    className="w-full"
                  >
                    <option value="">Select Product</option>
                    {availableProducts.map((p) => {
                      const stock = getProductStock(p.id, defaultWarehouseId);
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name || p.product_name} ({stock} in stock)
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="w-24">
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                    style={S}
                  />
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors hover:opacity-80 flex items-center gap-1"
                  style={{ background: "var(--color-brand-primary)", color: "white" }}
                >
                  <MdAddCircle size={14} /> Add
                </button>
              </div>
            </div>
          )}

          {/* ─── Cart Items ─── */}
          {cartItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>
                  Cart ({cartItems.length} items)
                </p>
                <span className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                  Total: {formatMoney(subtotal)}
                </span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {cartItems.map((item, index) => renderCartItem(item, index))}
              </div>
            </div>
          )}

          {/* ─── Empty Cart State ─── */}
          {cartItems.length === 0 && !initialProduct && (
            <div className="rounded-lg p-6 text-center"
              style={{ background: "var(--color-surface-1)", border: "1px dashed var(--color-border-soft)" }}>
              <MdShoppingCart size={32} style={{ color: "var(--color-text-faint)" }} className="mx-auto mb-2" />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No products in cart
              </p>
              <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
                Select products above to add them to the sale
              </p>
            </div>
          )}

          {/* ─── Customer Info ─── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                <MdPerson size={12} /> Customer Name
              </label>
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setCustomer(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Walk-in Customer"
                style={S}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                <MdEmail size={12} /> Email
              </label>
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer(prev => ({ ...prev, email: e.target.value }))}
                placeholder="customer@email.com"
                style={S}
              />
            </div>
          </div>

          {/* ─── Payment Details ─── */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                <MdPayment size={12} /> Payment Method *
              </label>
              <select
                value={payment.method}
                onChange={(e) => setPayment(prev => ({ ...prev, method: e.target.value as PaymentInfo['method'] }))}
                style={S_SELECT}
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="transfer">Bank Transfer</option>
                <option value="bank_deposit">Bank Deposit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                <MdPercent size={12} /> Discount (%)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={payment.discount}
                onChange={(e) => setPayment(prev => ({ ...prev, discount: Number(e.target.value) }))}
                style={S}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
                <MdPercent size={12} /> Tax (%)
              </label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={payment.tax}
                onChange={(e) => setPayment(prev => ({ ...prev, tax: Number(e.target.value) }))}
                style={S}
              />
            </div>
          </div>

          {/* ─── Notes ─── */}
          <div>
            <label className="block text-xs font-medium mb-1 flex items-center gap-1" style={{ color: "var(--color-text-secondary)" }}>
              <MdNote size={12} /> Notes
            </label>
            <textarea
              value={customer.notes}
              onChange={(e) => setCustomer(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional notes about this sale..."
              rows={2}
              style={{ ...S, resize: "vertical" }}
            />
          </div>

          {/* ─── Totals Summary ─── */}
          <div className="rounded-lg p-3 space-y-1"
            style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--color-text-muted)" }}>Subtotal</span>
              <span style={{ color: "var(--color-text-primary)" }}>{formatMoney(subtotal)}</span>
            </div>
            {payment.discount > 0 && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--color-text-muted)" }}>Discount ({payment.discount}%)</span>
                <span style={{ color: "var(--color-danger)" }}>-{formatMoney(discountAmount)}</span>
              </div>
            )}
            {payment.tax > 0 && (
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--color-text-muted)" }}>Tax ({payment.tax}%)</span>
                <span style={{ color: "var(--color-text-primary)" }}>+{formatMoney(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-semibold pt-1 border-t"
              style={{ borderColor: "var(--color-border-subtle)" }}>
              <span style={{ color: "var(--color-text-primary)" }}>Total</span>
              <span style={{ color: "var(--color-brand-primary-soft)" }}>{formatMoney(total)}</span>
            </div>
            <div className="flex justify-between text-[10px]" style={{ color: "var(--color-text-faint)" }}>
              <span>{cartItems.length} item{cartItems.length !== 1 ? "s" : ""} in cart</span>
              <span>{cartItems.reduce((sum, i) => sum + i.quantity, 0)} total units</span>
            </div>
          </div>

          {/* ─── Action Buttons ─── */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: "transparent",
                color: "var(--color-text-muted)",
                border: "1px solid var(--color-border-soft)",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || cartItems.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{
                background: "var(--color-brand-primary)",
                color: "white",
              }}
            >
              <MdReceipt size={16} />
              {loading ? "Processing..." : `Complete Sale (${cartItems.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};