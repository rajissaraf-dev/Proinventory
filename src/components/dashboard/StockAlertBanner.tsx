import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { Product } from "../../types";
import useCompanySettings from "../../hooks/useCompanySettings";

const StockAlertBanner = () => {
  const products = useSelector((s: RootState) => s.stock.productData);
  const companyId = useSelector((s: RootState) => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const { settings } = useCompanySettings(companyId);
  const lowStock = products.filter((p: Product) => Number(p.product_Qty) <= (settings.lowStockThreshold || 10));

  if (lowStock.length === 0) return null;

  return (
    <div className="w-full mb-4 bg-yellow-50 border border-yellow-300 rounded-lg p-3">
      <p className="text-yellow-800 font-semibold text-sm mb-1">
        ⚠ Low Stock Alert ({lowStock.length} {lowStock.length === 1 ? "item" : "items"})
      </p>
      <ul className="list-disc list-inside text-xs text-yellow-700 space-y-0.5">
        {lowStock.map((p: Product) => (
          <li key={p.id}>
            <span className="font-medium">{p.product_name}</span> —{" "}
            {p.product_Qty} {p.product_Qty === 1 ? p.size : `${p.size}s`} remaining
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StockAlertBanner;
