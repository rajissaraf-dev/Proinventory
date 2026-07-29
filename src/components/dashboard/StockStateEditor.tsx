// src/components/dashboard/StockStateEditor.tsx

import { useState } from "react";
import { MdClose } from "react-icons/md";
import { useDispatch } from "react-redux";
import { updateProduct } from "../../features/stock/stockSlice";

interface StockStateEditorProps {
  id: string;
  qty: number;
  price: number;
  companyId: string;
  warehouseId?: string;
  warehouseName?: string;
  canEditPrice: boolean;
  canDelete: boolean;
  onClose: () => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
  onUpdateComplete?: () => void; // ✅ Add callback for update complete
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

export const StockStateEditor = ({
  id,
  qty,
  price,
  companyId,
  warehouseId,
  warehouseName,
  canEditPrice,
  canDelete,
  onClose,
  onDelete,
  onUpdateComplete, // ✅ Add this
}: StockStateEditorProps) => {
  const dispatch = useDispatch();
  const [addQuantity, setAddQuantity] = useState<number>(0);
  const [productPrice, setProductPrice] = useState(price);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Current stock (display only)
  const currentStock = qty;

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } = await import("firebase/firestore");
      const { default: db } = await import("../../services/firebase");
      
      // Update product document
      const productRef = doc(db, "companies", companyId, "products", id);
      
      if (warehouseId) {
        // Get current inventory for this warehouse
        const inventoryId = `${id}_${warehouseId}`;
        const inventoryRef = doc(db, "companies", companyId, "inventory", inventoryId);
        
        // Get the current inventory data
        const inventoryQuery = query(
          collection(db, "companies", companyId, "inventory"), 
          where("productId", "==", id)
        );
        const inventorySnap = await getDocs(inventoryQuery);
        
        // Find the specific warehouse inventory
        let currentStock = 0;
        let warehouseNameToUse = warehouseName || warehouseId;
        
        inventorySnap.forEach((doc) => {
          const data = doc.data();
          if (data.warehouseId === warehouseId) {
            currentStock = data.quantity || 0;
            warehouseNameToUse = data.warehouseName || warehouseNameToUse;
          }
        });
        
        // Add the new quantity to existing stock
        const newStock = currentStock + addQuantity;
        
        // Update inventory for this warehouse
        await updateDoc(inventoryRef, {
          quantity: newStock,
          updatedAt: serverTimestamp(),
        });
        
        // Calculate total stock across all warehouses
        const allInventorySnap = await getDocs(
          query(collection(db, "companies", companyId, "inventory"), where("productId", "==", id))
        );
        let totalStock = 0;
        allInventorySnap.forEach((doc) => {
          totalStock += doc.data().quantity || 0;
        });
        
        // Update product with new total stock
        await updateDoc(productRef, {
          price: productPrice,
          stockQuantity: totalStock,
          status: totalStock === 0 ? "out_of_stock" : totalStock <= 10 ? "low_stock" : "in_stock",
          updatedAt: serverTimestamp(),
        });
        
        // Update Redux
        dispatch(updateProduct({
          id,
          changes: {
            stockQuantity: totalStock,
            price: productPrice,
            product_Price: productPrice,
            product_Qty: newStock,
          }
        }));
      } else {
        // Fallback: update product stock quantity directly
        let currentStock = qty;
        const snap = await getDocs(
          query(collection(db, "companies", companyId, "inventory"), where("productId", "==", id))
        );
        snap.forEach((doc) => {
          currentStock += doc.data().quantity || 0;
        });
        
        const newStock = currentStock + addQuantity;
        
        await updateDoc(productRef, {
          price: productPrice,
          stockQuantity: newStock,
          status: newStock === 0 ? "out_of_stock" : newStock <= 10 ? "low_stock" : "in_stock",
          updatedAt: serverTimestamp(),
        });
        
        dispatch(updateProduct({
          id,
          changes: {
            stockQuantity: newStock,
            price: productPrice,
            product_Price: productPrice,
            product_Qty: newStock,
          }
        }));
      }
      
      // ✅ Call the update complete callback
      if (onUpdateComplete) {
        onUpdateComplete();
      }
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "var(--color-surface-2)", border: "1px solid var(--color-border-brand)", boxShadow: "var(--shadow-card)" }}>
        
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Update Stock
          </h2>
          <button onClick={onClose} style={{ color: "var(--color-text-muted)" }}>
            <MdClose size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 rounded-lg text-xs" style={{ background: "var(--color-danger-soft)", color: "var(--color-danger)" }}>
            {error}
          </div>
        )}

        {/* Warehouse info */}
        <div className="mb-3 p-2 rounded-lg text-xs" 
          style={{ background: "var(--color-info-soft)", border: "1px solid var(--color-info-border)" }}>
          <div style={{ color: "var(--color-text-secondary)" }}>
            <strong style={{ color: "var(--color-text-primary)" }}>
              {warehouseName || warehouseId || "Main Warehouse"}
            </strong>
          </div>
          <div className="mt-1" style={{ color: "var(--color-text-faint)" }}>
            Current Stock: <strong style={{ color: "var(--color-text-primary)" }}>{currentStock}</strong> units
          </div>
        </div>

        <div className="space-y-4">
          {/* Add Quantity Field */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Add Quantity *
            </label>
            <input
              type="number"
              min={0}
              value={addQuantity === 0 ? "" : addQuantity}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  setAddQuantity(0);
                  return;
                }
                const parsed = Number(raw);
                if (!isNaN(parsed) && parsed >= 0) {
                  setAddQuantity(parsed);
                }
              }}
              placeholder={`Enter quantity to add (current: ${currentStock})`}
              style={S}
              required
            />
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-faint)" }}>
              This will be added to the existing stock of {currentStock} units
            </p>
            {addQuantity > 0 && (
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-stock-in)" }}>
                New total will be: <strong>{currentStock + addQuantity}</strong> units
              </p>
            )}
          </div>

          {/* Price Field */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--color-text-secondary)" }}>
              Price *
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              value={productPrice}
              onChange={(e) => setProductPrice(Number(e.target.value))}
              style={S}
              required
              disabled={!canEditPrice}
            />
          </div>

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
              type="button"
              onClick={handleSave}
              disabled={loading || addQuantity <= 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors hover:opacity-80 disabled:opacity-50"
              style={{
                background: "var(--color-brand-primary)",
                color: "white",
              }}
            >
              {loading ? "Updating..." : `Add ${addQuantity} Units`}
            </button>
          </div>

          {canDelete && onDelete && (
            <button
              onClick={(e) => {
                if (window.confirm("⚠️ Delete this product?\n\nThis action cannot be undone.")) {
                  onDelete(e, id);
                }
              }}
              className="w-full py-2 text-xs font-semibold transition-colors hover:opacity-70"
              style={{ color: "var(--color-danger)" }}
            >
              Delete Product
            </button>
          )}
        </div>
      </div>
    </div>
  );
};