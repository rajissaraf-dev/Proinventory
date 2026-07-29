import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, ArcElement,
  LineElement, PointElement,
  Tooltip, Legend, Filler,
  type ChartOptions,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { MdTrendingUp, MdTrendingDown, MdInfoOutline, MdCheckCircle, MdSwapHoriz, MdInventory2, MdAttachMoney } from "react-icons/md";
import { FiEdit2, FiMoreHorizontal } from "react-icons/fi";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { Product, InventoryRecord } from "../../types"; // ✅ Added InventoryRecord
import { StockMovementService } from "../../services/stock-movement.service";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement, Tooltip, Legend, Filler
);

/* ─────────────────────────────────────────────────────────────
   MINI SPARKLINE (used inside stat cards)
───────────────────────────────────────────────────────────── */
interface SparklineProps {
  data: number[];
  color: string;
  fill?: boolean;
}
const Sparkline = ({ data, color, fill = true }: SparklineProps) => (
  <Line
    data={{
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: fill ? `${color}22` : "transparent",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill,
      }],
    }}
    options={{
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: false,
    }}
    style={{ height: "48px" }}
  />
);

/* ─────────────────────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────────────────────── */
interface StatCardProps {
  title: string;
  value: string;
  change: number;
  sparkData: number[];
  sparkColor: string;
  iconBg: string;
  icon: React.ReactNode;
}
export const StatCard = ({ title, value, change, sparkData, sparkColor, iconBg, icon }: StatCardProps) => {
  const positive = change >= 0;
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden"
      style={{
        background: "var(--color-surface-1)",
        border: "1px solid var(--color-border-soft)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: "var(--color-text-muted)" }}>
            {title}
          </p>
          <p className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
            {value}
          </p>
        </div>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          {icon}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs">
        {positive
          ? <MdTrendingUp style={{ color: "var(--color-success)" }} />
          : <MdTrendingDown style={{ color: "var(--color-danger)" }} />}
        <span style={{ color: positive ? "var(--color-success)" : "var(--color-danger)" }}>
          {positive ? "+" : ""}{change}%
        </span>
        <span style={{ color: "var(--color-text-faint)" }}> vs last 30 days</span>
      </div>
      <div className="h-12 w-full mt-1">
        <Sparkline data={sparkData} color={sparkColor} />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   INVENTORY TURNOVER BAR CHART
───────────────────────────────────────────────────────────── */
interface InventoryTurnoverChartProps {
  productsOverride?: Product[];
}

export const InventoryTurnoverChart = ({ productsOverride }: InventoryTurnoverChartProps) => {
  const reduxProducts = useSelector((s: RootState) => s.stock.productData);
  const products = productsOverride ?? reduxProducts;

  const labels = ["Apr 24","Apr 29","May 4","May 9","May 14","May 19","May 24"];
  const soldData    = [8000,12000,15000,10000,18000,14000,20000];
  const returnData  = [2000,3000,2500,1500,4000,3500,2000];
  const adjustData  = [1000,1500,3000,2000,2500,1000,3500];

  // overlay real product data if available
  if (products.length > 0) {
    products.slice(0, 7).forEach((p: Product, i: number) => {
      soldData[i] = Math.min(p.product_Qty * 10, 20000);
    });
  }

  const data = {
    labels,
    datasets: [
      { label: "Sold", data: soldData, backgroundColor: "rgba(99,102,241,0.85)", borderRadius: 3, stack: "a" },
      { label: "Returned", data: returnData, backgroundColor: "rgba(34,197,94,0.75)", borderRadius: 3, stack: "a" },
      { label: "Adjustment", data: adjustData, backgroundColor: "rgba(245,158,11,0.75)", borderRadius: 3, stack: "a" },
    ],
  };

  const options: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        align: "start" as const,
        labels: { color: "#94a3b8", boxWidth: 10, font: { size: 11 }, padding: 12 },
      },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        stacked: true,
        grid: { color: "rgba(255,255,255,0.05)" },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: (v: number | string) => Number(v) >= 1000 ? `${Number(v) / 1000}K` : v,
        },
      },
    },
  };

  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Inventory Turnover <span style={{ color: "var(--color-text-faint)" }}>(Last 30 Days)</span>
          </p>
        </div>
        <button
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
          style={{ background: "var(--color-surface-3)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}
        >
          Last 30 Days ▾
        </button>
      </div>
      <div style={{ height: "200px" }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   STOCK DISTRIBUTION DONUT CHART
───────────────────────────────────────────────────────────── */
interface CategoryDonutChartProps {
  productsOverride?: Product[];
}

export const CategoryDonutChart = ({ productsOverride }: CategoryDonutChartProps) => {
  const reduxProducts = useSelector((s: RootState) => s.stock.productData);
  const products = productsOverride ?? reduxProducts;

  const categoryMap = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((p: Product) => {
      const cat = p.product_description ?? "Others";
      map[cat] = (map[cat] ?? 0) + p.product_Qty;
    });
    return map;
  }, [products]);

  const hasReal = Object.keys(categoryMap).length > 0;
  const labels  = hasReal ? Object.keys(categoryMap) : ["Electronics","Apparel","Groceries","Home & Kitchen","Others"];
  const values  = hasReal ? Object.values(categoryMap) : [38.6, 24.5, 18.7, 9.8, 8.4];
  const total   = values.reduce((a, b) => a + b, 0);

  const COLORS = ["#6366f1","#22c55e","#f59e0b","#38bdf8","#94a3b8"];
  const PCT    = values.map((v) => ((v / total) * 100).toFixed(1));

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: COLORS,
      borderColor: "transparent",
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "68%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => ` ${context.label}: ${PCT[context.dataIndex]}%`,
        },
      },
    },
  };

  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          Stock Distribution by Category
        </p>
        <MdInfoOutline size={14} style={{ color: "var(--color-text-faint)" }} />
      </div>

      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: 140, height: 140 }}>
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-lg font-extrabold leading-none" style={{ color: "var(--color-text-primary)" }}>
              {total.toLocaleString()}
            </p>
            <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Total items</p>
          </div>
        </div>

        {/* Legend */}
        <ul className="flex-1 space-y-2">
          {labels.map((label, i) => (
            <li key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>{label}</span>
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {PCT[i]}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <button className="mt-3 text-xs self-start" style={{ color: "var(--color-brand-primary-soft)" }}>
        View full report →
      </button>
    </div>
  );
};


/* ─────────────────────────────────────────────────────────────
   LOW STOCK ALERT PANEL
───────────────────────────────────────────────────────────── */
interface LowStockPanelProps {
  productsOverride?: Product[];
  warehouseId?: string;
  warehouseInventory?: Record<string, InventoryRecord[]>;
}

export const LowStockPanel = ({ 
  productsOverride, 
  warehouseId,
  warehouseInventory: propWarehouseInventory 
}: LowStockPanelProps) => {
  const reduxProducts = useSelector((s: RootState) => s.stock.productData);
  const products = productsOverride ?? reduxProducts;
  const warehouseInventory = propWarehouseInventory || {};

  // Get warehouse-specific stock levels
  const getWarehouseStock = (productId: string): number => {
    if (!warehouseId) {
      const product = products.find(p => p.id === productId);
      return product?.product_Qty || 0;
    }
    
    const inventoryItems = warehouseInventory[warehouseId] || [];
    const item = inventoryItems.find((i: InventoryRecord) => i.productId === productId); // ✅ Fixed any
    return item?.quantity || 0;
  };

  // ✅ Separate out-of-stock and low-stock items
  const outOfStockItems = products
    .filter((p: Product) => getWarehouseStock(p.id) === 0)
    .slice(0, 5);
    
  const lowStockItems = products
    .filter((p: Product) => {
      const stock = getWarehouseStock(p.id);
      return stock > 0 && stock <= 10;
    })
    .sort((a, b) => getWarehouseStock(a.id) - getWarehouseStock(b.id))
    .slice(0, 5);

  // Combine: out of stock first, then low stock
  const allItems = [...outOfStockItems, ...lowStockItems].slice(0, 8);

  // Show empty state when no low stock items
  if (allItems.length === 0) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "var(--color-stock-in-soft)" }}>
            <MdCheckCircle size={24} style={{ color: "var(--color-stock-in)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            All Stock Levels Are Healthy
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            {warehouseId 
              ? `All products in this warehouse have more than 10 units in stock.` 
              : `All products have more than 10 units in stock.`}
          </p>
        </div>
      </div>
    );
  }

  const stockColor = (qty: number) =>
    qty === 0 ? "var(--color-danger)" : qty <= 3 ? "var(--color-warning)" : "var(--color-stock-low)";

  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          Stock Alert
          {warehouseId && <span style={{ color: "var(--color-text-faint)" }}> in {warehouseId}</span>}
          <span className="ml-2 text-[10px] font-normal" style={{ color: "var(--color-text-faint)" }}>
            ({outOfStockItems.length} out of stock • {lowStockItems.length} low stock)
          </span>
        </p>
        <button className="text-xs" style={{ color: "var(--color-brand-primary-soft)" }}>View All</button>
      </div>

      <ul className="space-y-3">
        {allItems.map((item, i) => {
          const product = item as Product;
          const stock = getWarehouseStock(product.id);
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock <= 10;
          
          return (
            <li key={product.id ?? i} className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-lg"
                style={{ background: isOutOfStock ? "var(--color-danger-soft)" : "var(--color-stock-low-soft)" }}
              >
                {product.img
                  ? <img src={product.img} alt="" className="w-full h-full rounded-lg object-cover" />
                  : isOutOfStock ? "🚫" : "⚠️"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                  {product.product_name}
                  {isOutOfStock && (
                    <span className="ml-2 text-[10px] font-normal" style={{ color: "var(--color-danger)" }}>
                      (Out of Stock)
                    </span>
                  )}
                  {isLowStock && (
                    <span className="ml-2 text-[10px] font-normal" style={{ color: "var(--color-stock-low)" }}>
                      (Low Stock)
                    </span>
                  )}
                </p>
                <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                  {product.sku ?? `SKU-${product.id?.slice(0, 6).toUpperCase()}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Stock</p>
                <p className={`text-sm font-extrabold ${isOutOfStock ? 'animate-pulse' : ''}`} 
                   style={{ color: stockColor(stock) }}>
                  {stock}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      
      {/* Show summary if there are more items */}
      {allItems.length >= 8 && (
        <div className="mt-3 pt-2 text-center text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          Showing top {allItems.length} items. View all for complete list.
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   RECENT ACTIVITY PANEL
───────────────────────────────────────────────────────────── */

interface ActivityItem {
  icon: string;
  iconBg: string;
  text: React.ReactNode;
  time: string;
}

interface RecentActivityPanelProps {
  warehouseId?: string; // ✅ Removed unused productsOverride
}

export const RecentActivityPanel = ({ warehouseId }: RecentActivityPanelProps) => {
  // ✅ Removed unused reduxProducts and productsOverride
  const companyId = useSelector((s: RootState) => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Load real activity data filtered by warehouse
  useEffect(() => {
    const loadActivities = async () => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        let movements = await StockMovementService.listRecent(companyId, 20);
        
        if (warehouseId) {
          movements = movements.filter(m => m.warehouseId === warehouseId);
        }
        
        movements = movements.slice(0, 5);
        
        const activityItems: ActivityItem[] = movements.map((movement) => {
          const isPositive = movement.quantity > 0;
          const icon = isPositive ? "📦" : "📤";
          const iconBg = isPositive ? "var(--color-stock-in-soft)" : "var(--color-stock-out-soft)";
          const action = isPositive ? "added" : "removed";
          
          const d = movement.createdAt instanceof Date
            ? movement.createdAt
            : typeof movement.createdAt === "object" && movement.createdAt !== null && "toDate" in movement.createdAt
              ? movement.createdAt.toDate()
              : new Date();
          
          const timeAgo = getTimeAgo(d);
          
          return {
            icon,
            iconBg,
            text: (
              <>
                <strong>{movement.productName}</strong> {action} <strong>{Math.abs(movement.quantity)}</strong> units
                {movement.type && ` (${movement.type.replace("_", " ")})`}
                {warehouseId && ` in ${movement.warehouseId}`} {/* ✅ Fixed - use warehouseId */}
              </>
            ),
            time: timeAgo,
          };
        });
        
        setActivities(activityItems);
      } catch (error) {
        console.error("Failed to load activities:", error);
        setActivities([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadActivities();
  }, [companyId, warehouseId]);


  // Show loading state
  if (loading) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "var(--color-brand-primary)" }} />
        <p className="text-xs mt-2" style={{ color: "var(--color-text-muted)" }}>Loading activity...</p>
      </div>
    );
  }

  // Show empty state when no activities exist
  if (activities.length === 0) {
    return (
      <div
        className="rounded-xl p-4 flex flex-col items-center justify-center min-h-[200px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: "var(--color-surface-3)" }}>
            <MdSwapHoriz size={24} style={{ color: "var(--color-text-faint)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            No Recent Activity
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>
            {warehouseId 
              ? `No activity in this warehouse yet.` 
              : `Activity will appear here when you start adding products, making transfers, or updating inventory.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
          Recent Activity {warehouseId && <span style={{ color: "var(--color-text-faint)" }}>in {warehouseId}</span>}
        </p>
        <button className="text-xs" style={{ color: "var(--color-brand-primary-soft)" }}>View All</button>
      </div>

      <ul className="space-y-4">
        {activities.map((a, i) => (
          <li key={i} className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm"
              style={{ background: a.iconBg }}
            >
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-snug" style={{ color: "var(--color-text-secondary)" }}>
                {a.text}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                {a.time}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   PRODUCTS OVERVIEW TABLE
───────────────────────────────────────────────────────────── */
interface ProductsTableProps {
  onEdit?: (id: string) => void;
  onAdd?:  () => void;
  onSell?: (product: Product) => void;
  readOnly?: boolean;
  productsOverride?: Product[];
}

export const ProductsTable = ({ onEdit, onAdd,onSell, readOnly = false, productsOverride }: ProductsTableProps) => {
  const reduxProducts = useSelector((s: RootState) => s.stock.productData);
  const products = productsOverride ?? reduxProducts;

  // If no products, show empty state
  if (products.length === 0) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center min-h-[300px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--color-surface-3)" }}>
            <MdInventory2 size={32} style={{ color: "var(--color-text-faint)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            No Products Added Yet
          </p>
          <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: "var(--color-text-muted)" }}>
            Start by adding your first product to track inventory, stock levels, and orders.
          </p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
              style={{ background: "var(--color-brand-primary)", color: "white" }}
            >
              + Add Your First Product
            </button>
          )}
        </div>
      </div>
    );
  }

  const PAGE_SIZE = 6;
  const visible = products.slice(0, PAGE_SIZE);

  const statusInfo = (qty: number): { label: string; bg: string; text: string; border: string } => {
    if (qty === 0)  return { label: "Out of Stock", bg: "var(--color-stock-out-soft)",   text: "var(--color-stock-out)",   border: "var(--color-stock-out-border)" };
    if (qty <= 5)   return { label: "Low Stock",    bg: "var(--color-stock-low-soft)",   text: "var(--color-stock-low)",   border: "var(--color-stock-low-border)" };
    return           { label: "In Stock",           bg: "var(--color-stock-in-soft)",    text: "var(--color-stock-in)",    border: "var(--color-stock-in-border)" };
  };

  return (
    <div
      className="rounded-xl flex flex-col"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
    >
      {/* Table header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-primary)" }}>
          Products Overview
        </h3>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-xs"
            style={{
              background: "var(--color-input-bg)",
              border: "1px solid var(--color-input-border)",
              color: "var(--color-input-placeholder)",
            }}
          >
            🔍 Search products...
          </div>
          <button
            className="h-8 px-3 rounded-lg text-xs flex items-center gap-1"
            style={{
              background: "var(--color-surface-3)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-soft)",
            }}
          >
            ⚙ Filters
          </button>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "var(--color-text-muted)" }}>
            <FiMoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              {["", "SKU", "Product Name", "Category", "Price", "Stock Quantity", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold uppercase tracking-wide"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item) => {
              const product = item as Product;
              const status = statusInfo(product.product_Qty ?? 0);
              return (
                <tr
                  key={product.id}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-surface-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3">
                    <input type="checkbox" className="accent-indigo-500 w-3.5 h-3.5" />
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-text-muted)" }}>{product.sku}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-sm"
                        style={{ background: "var(--color-surface-3)" }}
                      >
                        {product.img ? <img src={product.img} className="w-full h-full rounded-md object-cover" alt="" /> : "📦"}
                      </div>
                      <span className="font-medium truncate max-w-[120px]" style={{ color: "var(--color-text-primary)" }}>
                        {product.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>{product.categoryName}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-text-primary)" }}>
                    ${Number(product.product_Price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {product.product_Qty}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded-md text-[10px] font-semibold"
                      style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}` }}
                    >
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {readOnly ? (
                      <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>View only</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        {/* ✅ Sell Button - New */}
                    
                        {onSell && product.product_Qty > 0 && !readOnly && (
                          <button
                            onClick={() => onSell(product)}
                            className="w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-green-500/10"
                            style={{ color: "var(--color-success)" }}
                            title="Sell product"
                          >
                            <MdAttachMoney size={12} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(product.id)}
                            className="w-6 h-6 flex items-center justify-center rounded"
                            style={{ color: "var(--color-text-muted)" }}
                          >
                            <FiEdit2 size={12} />
                          </button>
                        )}
                        <button className="w-6 h-6 flex items-center justify-center rounded" style={{ color: "var(--color-text-muted)" }}>
                          <FiMoreHorizontal size={12} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        className="flex items-center justify-between px-4 py-3 text-xs"
        style={{
          borderTop: "1px solid var(--color-border-subtle)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>Showing 1 to {Math.min(PAGE_SIZE, products.length)} of {products.length} products</span>
        <div className="flex items-center gap-1">
          {["‹", "1", "2", "3", "4", "5", "...", "9", "›"].map((p, i) => (
            <button
              key={i}
              className="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors"
              style={
                p === "1"
                  ? { background: "var(--color-brand-primary)", color: "white" }
                  : { color: "var(--color-text-muted)" }
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};