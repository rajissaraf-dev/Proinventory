// src/components/dashboard/OrderModal.tsx

import { useState } from "react";
import { MdClose, MdShoppingCart, MdAdd, MdRemove } from "react-icons/md";
import { Product } from "../../types";

interface OrderModalProps {
  companyId: string;
  warehouseId: string;
  warehouseName: string;
  products: Product[];
  onClose: () => void;
  onOrderComplete: () => void;
}

interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  price: number;
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

export const OrderModal = ({
  companyId,
  warehouseId,
  warehouseName,
  products,
  onClose,
  onOrderComplete,
}: OrderModalProps) => {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProduct = (id: string) => products.find(p => p.id === id);
  const getProductStock = (id: string) => {
    const product = getProduct(id);
    return product?.product_Qty || 0;
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const product = getProduct(selectedProduct);
    if (!product) return;
    
    const maxQty = getProductStock(selectedProduct);
    if (quantity > maxQty) {
      setError(`Only ${maxQty} units available`);
      return;
    }

    setOrderItems(prev => {
      const existing = prev.find(item => item.productId === selectedProduct);
      if (existing) {
        return prev.map(item =>
          item.productId === selectedProduct
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, {
        productId: selectedProduct,
        productName: product.name || product.product_name || "",
        sku: product.sku || "",
        quantity,
        price: product.price || product.product_Price || 0,
      }];
    });

    setSelectedProduct("");
    setQuantity(1);
    setError(null);
  };

  const handleRemoveItem = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setOrderItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (orderItems.length === 0) {
      setError("Please add at least one item to the order");
      return;
    }

    setLoading(true);
    try {
      const { OrderService } = await import("../../services/order.service");
      
      await OrderService.createOrder({
        companyId,
        warehouseId,
        warehouseName,
        items: orderItems,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        notes: notes || undefined,
        createdBy: "system",
      });

      onOrderComplete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-brand)", boxShadow: "var(--shadow-card)" }}>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--color-brand-primary-soft)" }}>
              <MdShoppingCart size={20} style={{ color: "var(--color-brand-primary)" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Create New Order
              </h2>
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Warehouse: {warehouseName}
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
          {/* Add Items */}
          <div className="rounded-lg p-4" style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--color-text-secondary)" }}>
              Add Items to Order
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  style={S}
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name || p.product_name} (Stock: {p.product_Qty || 0})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  style={S}
                  placeholder="Qty"
                />
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center justify-center gap-1 rounded-xl text-sm font-semibold"
                style={{ background: "var(--color-brand-primary)", color: "white" }}
              >
                <MdAdd size={16} /> Add
              </button>
            </div>
          </div>

          {/* Order Items List */}
          {orderItems.length > 0 && (
            <div className="rounded-lg p-3" style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}>
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-text-secondary)" }}>
                Order Items ({orderItems.length})
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orderItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between text-xs p-2 rounded"
                    style={{ background: "var(--color-surface-2)" }}>
                    <span style={{ color: "var(--color-text-primary)" }}>{item.productName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <MdRemove size={12} />
                      </button>
                      <span style={{ color: "var(--color-text-primary)" }}>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center rounded"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        <MdAdd size={12} />
                      </button>
                      <span className="ml-2" style={{ color: "var(--color-text-faint)" }}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="ml-1 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 text-right text-xs font-semibold border-t"
                style={{ borderColor: "var(--color-border-subtle)" }}>
                Total: ${totalAmount.toFixed(2)}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer name"
                style={S}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
                Customer Phone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number"
                style={S}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Customer Email
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
              style={S}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              style={{ ...S, resize: "vertical" }}
            />
          </div>

          {/* Action Buttons */}
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
              disabled={loading || orderItems.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-50"
              style={{
                background: "var(--color-brand-primary)",
                color: "white",
              }}
            >
              {loading ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};