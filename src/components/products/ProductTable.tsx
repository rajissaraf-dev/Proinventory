// src/components/products/ProductTable.tsx
import { Product } from "../../types";
import {
  MdEdit,
  MdDelete,
  MdSell,
  MdAdd,
  MdSearchOff,
  MdInventory,
} from "react-icons/md";

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  onSell: (product: Product) => void;
  onAdd: () => void;
  warehouseName?: string;
}

const ProductTable = ({
  products,
  isLoading,
  isOwner,
  isAdmin,
  onEdit,
  onDelete,
  onSell,
  onAdd,
  warehouseName,
}: ProductTableProps) => {
  const canEdit = isOwner || isAdmin;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div
          className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--color-brand-primary)" }}
        />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{
          background: "var(--color-surface-1)",
          border: "1px dashed var(--color-border-soft)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "var(--color-surface-3)" }}
          >
            <MdSearchOff size={32} style={{ color: "var(--color-text-faint)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
              No products found
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
              {warehouseName
                ? `No products in "${warehouseName}" matching your search`
                : "Try adjusting your search or filters"}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={onAdd}
              className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--color-brand-primary)", color: "white" }}
            >
              <MdAdd size={16} /> Add Product
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border-soft)",
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              <th
                className="px-4 py-3 text-left font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Product
              </th>
              <th
                className="px-4 py-3 text-left font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                SKU
              </th>
              <th
                className="px-4 py-3 text-left font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Category
              </th>
              <th
                className="px-4 py-3 text-right font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Price
              </th>
              <th
                className="px-4 py-3 text-right font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Stock
              </th>
              <th
                className="px-4 py-3 text-center font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Status
              </th>
              <th
                className="px-4 py-3 text-right font-semibold uppercase tracking-wide"
                style={{ color: "var(--color-text-faint)" }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const stockQty = product.stockQuantity ?? product.product_Qty ?? 0;
              let statusLabel: string;
              let statusColor: { bg: string; text: string };

              if (stockQty === 0) {
                statusLabel = "Out of Stock";
                statusColor = {
                  bg: "var(--color-stock-out-soft)",
                  text: "var(--color-stock-out)",
                };
              } else if (stockQty <= 10) {
                statusLabel = "Low Stock";
                statusColor = {
                  bg: "var(--color-stock-low-soft)",
                  text: "var(--color-stock-low)",
                };
              } else {
                statusLabel = "In Stock";
                statusColor = {
                  bg: "var(--color-stock-in-soft)",
                  text: "var(--color-stock-in)",
                };
              }

              return (
                <tr
                  key={product.id}
                  style={{
                    borderBottom:
                      index < products.length - 1
                        ? "1px solid var(--color-border-subtle)"
                        : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--color-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.imageUrl || product.img ? (
                        <img
                          src={product.imageUrl || product.img}
                          alt={product.name}
                          className="w-8 h-8 rounded-lg object-cover"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ background: "var(--color-surface-3)" }}
                        >
                          <MdInventory size={16} style={{ color: "var(--color-text-faint)" }} />
                        </div>
                      )}
                      <div>
                        <p
                          className="font-medium text-sm"
                          style={{ color: "var(--color-text-primary)" }}
                        >
                          {product.name}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                          {product.product_description || product.categoryName || "No description"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-[10px]"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {product.sku || `SKU-${product.id.slice(0, 6).toUpperCase()}`}
                  </td>
                  <td
                    className="px-4 py-3"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {product.categoryName || "Uncategorized"}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    ${(product.price ?? product.product_Price ?? 0).toFixed(2)}
                  </td>
                  <td
                    className="px-4 py-3 text-right font-semibold"
                    style={{ color: "var(--color-text-primary)" }}
                  >
                    {stockQty}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                      style={{
                        background: statusColor.bg,
                        color: statusColor.text,
                      }}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Sell button - available to all */}
                      {stockQty > 0 && (
                        <button
                          onClick={() => onSell(product)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
                          style={{
                            background: "var(--color-stock-in-soft)",
                            color: "var(--color-stock-in)",
                          }}
                          title="Sell product"
                        >
                          <MdSell size={13} />
                        </button>
                      )}

                      {/* Edit/Delete buttons - only for owner/admin */}
                      {canEdit && (
                        <>
                          <button
                            onClick={() => onEdit(product)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
                            style={{
                              background: "var(--color-surface-3)",
                              color: "var(--color-brand-primary-soft)",
                            }}
                            title="Edit product"
                          >
                            <MdEdit size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `⚠️ Delete "${product.name}"?\n\nThis will permanently remove this product and all its inventory records.\n\nThis action cannot be undone.`
                                )
                              ) {
                                onDelete(product.id);
                              }
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors hover:opacity-70"
                            style={{
                              background: "var(--color-danger-soft)",
                              color: "var(--color-danger)",
                            }}
                            title="Delete product"
                          >
                            <MdDelete size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer with count */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          {products.length} product{products.length !== 1 ? "s" : ""} found
        </span>
        {canEdit && (
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--color-brand-primary)", color: "white" }}
          >
            <MdAdd size={14} /> Add Product
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductTable;