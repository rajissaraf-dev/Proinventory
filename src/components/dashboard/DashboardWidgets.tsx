// src/components/dashboard/DashboardWidgets.tsx
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
import { 
  MdTrendingUp, MdTrendingDown, MdInfoOutline, MdCheckCircle, 
  MdSwapHoriz, MdInventory2, MdAttachMoney, MdLock,
  MdWarning, MdError, MdDoneAll, MdArrowForward,
  MdSearch, MdFilterList, MdMoreVert
} from "react-icons/md";
import { FiEdit2, FiMoreHorizontal } from "react-icons/fi";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { Product, InventoryRecord } from "../../types";
import { StockMovementService } from "../../services/stock-movement.service";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  LineElement, PointElement, Tooltip, Legend, Filler
);

/* ─────────────────────────────────────────────────────────────
   MINI SPARKLINE (enhanced)
───────────────────────────────────────────────────────────── */
interface SparklineProps {
  data: number[];
  color: string;
  fill?: boolean;
}

const Sparkline = ({ data, color, fill = true }: SparklineProps) => {
  // Guard against empty data
  if (!data || data.length === 0) {
    return (
      <div className="h-12 flex items-center justify-center">
        <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          No data available
        </span>
      </div>
    );
  }

  return (
    <Line
      data={{
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: fill ? `${color}22` : "transparent",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.4,
          fill,
        }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: false }, 
          tooltip: { 
            enabled: true,
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#e2e8f0',
            cornerRadius: 8,
            padding: 8,
          } 
        },
        scales: { 
          x: { display: false }, 
          y: { display: false } 
        },
        animation: {
          duration: 600,
          easing: 'easeInOutQuart',
        },
        interaction: {
          intersect: false,
          mode: 'index',
        },
      }}
      style={{ height: "48px" }}
    />
  );
};

/* ─────────────────────────────────────────────────────────────
   STAT CARD (enhanced with restricted state)
───────────────────────────────────────────────────────────── */
interface StatCardProps {
  title: string;
  value: string;
  change?: number;
  sparkData?: number[];
  sparkColor?: string;
  iconBg: string;
  icon: React.ReactNode;
  restricted?: boolean;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard = ({ 
  title, 
  value, 
  change, 
  sparkData, 
  sparkColor, 
  iconBg, 
  icon, 
  restricted = false,
}: StatCardProps) => {
  const positive = change !== undefined && change >= 0;
  const showTrend = change !== undefined && !restricted;
  
  // Determine trend icon
  const TrendIcon = () => {
    if (restricted) return null;
    if (positive) return <MdTrendingUp style={{ color: "var(--color-success)" }} />;
    if (change !== undefined && change < 0) return <MdTrendingDown style={{ color: "var(--color-danger)" }} />;
    return null;
  };

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] group"
      style={{
        background: "var(--color-surface-1)",
        border: `1px solid ${restricted ? "var(--color-border-soft)" : "var(--color-border-soft)"}`,
        opacity: restricted ? 0.85 : 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            {title}
          </p>
          <p
            className={`text-2xl font-extrabold mt-1 transition-all ${
              restricted ? "tracking-wider" : ""
            }`}
            style={{
              color: restricted ? "var(--color-text-muted)" : "var(--color-text-primary)",
            }}
          >
            {value}
          </p>
          {!restricted && showTrend && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-0.5 text-xs font-medium">
                <TrendIcon />
                <span style={{ color: positive ? "var(--color-success)" : "var(--color-danger)" }}>
                  {positive ? "+" : ""}{change}%
                </span>
              </div>
              <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                vs last 30 days
              </span>
            </div>
          )}
          {restricted && (
            <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: "var(--color-text-faint)" }}>
              <MdLock size={12} /> Owner only
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
          style={{
            background: restricted ? "var(--color-surface-3)" : iconBg,
          }}
        >
          {icon}
        </div>
      </div>

      {/* Sparkline */}
      {!restricted && sparkData && sparkData.length > 0 && (
        <div className="mt-3 h-12">
          <Sparkline data={sparkData} color={sparkColor || "var(--color-brand-primary-soft)"} />
        </div>
      )}
      {restricted && (
        <div className="mt-3 h-12 flex items-center justify-center rounded-lg" style={{ background: "var(--color-surface-2)" }}>
          <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
            🔒 Financial data restricted
          </span>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   INVENTORY TURNOVER BAR CHART (enhanced)
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

  if (products.length > 0) {
    products.slice(0, 7).forEach((p: Product, i: number) => {
      soldData[i] = Math.min(p.product_Qty * 10, 20000);
    });
  }

  const data = {
    labels,
    datasets: [
      { 
        label: "Sold", 
        data: soldData, 
        backgroundColor: "rgba(99,102,241,0.85)", 
        borderRadius: 4, 
        stack: "a",
        hoverBackgroundColor: "rgba(99,102,241,1)",
      },
      { 
        label: "Returned", 
        data: returnData, 
        backgroundColor: "rgba(34,197,94,0.75)", 
        borderRadius: 4, 
        stack: "a",
        hoverBackgroundColor: "rgba(34,197,94,1)",
      },
      { 
        label: "Adjustment", 
        data: adjustData, 
        backgroundColor: "rgba(245,158,11,0.75)", 
        borderRadius: 4, 
        stack: "a",
        hoverBackgroundColor: "rgba(245,158,11,1)",
      },
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
        labels: { 
          color: "#94a3b8", 
          boxWidth: 12, 
          font: { 
            size: 11, 
            weight: 'normal' as const,
          }, 
          padding: 16,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: { 
        mode: "index" as const, 
        intersect: false,
        backgroundColor: 'rgba(15,23,42,0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        cornerRadius: 8,
        padding: 12,
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { 
          display: false, // ← Hide x-axis grid lines
        },
        border: {
          display: false, // ← Hide x-axis border
        },
        ticks: { color: "#64748b", font: { size: 11 } },
      },
      y: {
        stacked: true,
        grid: { 
          color: "rgba(255,255,255,0.05)", // ← Grid line color
          lineWidth: 1,                    // ← Grid line width
        },
        border: {
          display: false, // ← Hide y-axis border
        },
        ticks: {
          color: "#64748b",
          font: { size: 11 },
          callback: (v: number | string) => Number(v) >= 1000 ? `${Number(v) / 1000}K` : v,
        },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeInOutQuart',
    },
  };

  return (
    <div
      className="rounded-xl p-5 flex flex-col transition-all hover:shadow-md"
      style={{ 
        background: "var(--color-surface-1)", 
        border: "1px solid var(--color-border-soft)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Inventory Turnover
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg" style={{ 
            background: "var(--color-surface-3)", 
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border-soft)" 
          }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "rgba(99,102,241,0.85)" }} />
            <span>Sold</span>
            <span className="w-2 h-2 rounded-full ml-1" style={{ background: "rgba(34,197,94,0.75)" }} />
            <span>Returned</span>
            <span className="w-2 h-2 rounded-full ml-1" style={{ background: "rgba(245,158,11,0.75)" }} />
            <span>Adj</span>
          </div>
          <button
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-70"
            style={{ 
              background: "var(--color-surface-3)", 
              color: "var(--color-text-muted)", 
              border: "1px solid var(--color-border-soft)" 
            }}
          >
            Last 30 Days <span className="text-[10px]">▾</span>
          </button>
        </div>
      </div>
      <div style={{ height: "200px" }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};
/* ─────────────────────────────────────────────────────────────
   STOCK DISTRIBUTION DONUT CHART (enhanced)
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
      hoverOffset: 8,
    }],
  };

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: (context) => ` ${context.label}: ${PCT[context.dataIndex]}%`,
        },
      },
    },
    animation: {
      animateRotate: true,
      duration: 800,
    },
  };

  return (
    <div
      className="rounded-xl p-5 flex flex-col transition-all hover:shadow-md"
      style={{ 
        background: "var(--color-surface-1)", 
        border: "1px solid var(--color-border-soft)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Stock Distribution
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>By category</p>
        </div>
        <MdInfoOutline size={16} style={{ color: "var(--color-text-faint)" }} className="cursor-help" />
      </div>

      <div className="flex items-center gap-5">
        {/* Donut with improved center text */}
        <div className="relative shrink-0" style={{ width: 150, height: 150 }}>
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xl font-extrabold leading-none" style={{ color: "var(--color-text-primary)" }}>
              {total.toLocaleString()}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--color-text-faint)" }}>Total Items</p>
          </div>
        </div>

        {/* Enhanced Legend with progress bars */}
        <ul className="flex-1 space-y-2.5">
          {labels.slice(0, 5).map((label, i) => (
            <li key={label} className="flex items-center justify-between group">
              <div className="flex items-center gap-2.5 flex-1">
                <span className="w-3 h-3 rounded-full shrink-0 transition-all group-hover:scale-110" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-xs truncate max-w-[100px]" style={{ color: "var(--color-text-secondary)" }}>
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-3)" }}>
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${PCT[i]}%`,
                      background: COLORS[i % COLORS.length],
                    }} 
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right" style={{ color: "var(--color-text-primary)" }}>
                  {PCT[i]}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button 
        className="mt-4 text-xs self-start flex items-center gap-1 transition-all hover:gap-2" 
        style={{ color: "var(--color-brand-primary-soft)" }}
      >
        View full report <MdArrowForward size={12} />
      </button>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   LOW STOCK ALERT PANEL (enhanced)
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

  const getWarehouseStock = (productId: string): number => {
    if (!warehouseId) {
      const product = products.find(p => p.id === productId);
      return product?.product_Qty || 0;
    }
    const inventoryItems = warehouseInventory[warehouseId] || [];
    const item = inventoryItems.find((i: InventoryRecord) => i.productId === productId);
    return item?.quantity || 0;
  };

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

  const allItems = [...outOfStockItems, ...lowStockItems].slice(0, 8);
  const totalAlerts = outOfStockItems.length + lowStockItems.length;

  if (allItems.length === 0) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center min-h-[220px] transition-all hover:shadow-md"
        style={{ 
          background: "var(--color-surface-1)", 
          border: "1px solid var(--color-border-soft)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce" style={{ background: "var(--color-stock-in-soft)" }}>
            <MdDoneAll size={28} style={{ color: "var(--color-stock-in)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            All Stock Levels Are Healthy
          </p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--color-text-muted)" }}>
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
      className="rounded-xl p-5 flex flex-col transition-all hover:shadow-md"
      style={{ 
        background: "var(--color-surface-1)", 
        border: "1px solid var(--color-border-soft)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Stock Alert
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {warehouseId && (
              <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                in {warehouseId}
              </span>
            )}
            <span className="flex items-center gap-2 text-[10px]">
              {outOfStockItems.length > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "var(--color-danger-soft)" }}>
                  <MdError size={10} style={{ color: "var(--color-danger)" }} />
                  <span style={{ color: "var(--color-danger)" }}>{outOfStockItems.length} out of stock</span>
                </span>
              )}
              {lowStockItems.length > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "var(--color-stock-low-soft)" }}>
                  <MdWarning size={10} style={{ color: "var(--color-stock-low)" }} />
                  <span style={{ color: "var(--color-stock-low)" }}>{lowStockItems.length} low stock</span>
                </span>
              )}
            </span>
          </div>
        </div>
        <button 
          className="text-xs flex items-center gap-1 transition-all hover:gap-2" 
          style={{ color: "var(--color-brand-primary-soft)" }}
        >
          View All <MdArrowForward size={12} />
        </button>
      </div>

      <ul className="space-y-3">
        {allItems.map((item, i) => {
          const product = item as Product;
          const stock = getWarehouseStock(product.id);
          const isOutOfStock = stock === 0;
          const isLowStock = stock > 0 && stock <= 10;
          
          return (
            <li 
              key={product.id ?? i} 
              className={`flex items-center gap-3 p-2 rounded-xl transition-all hover:scale-[1.01] ${
                isOutOfStock ? 'animate-pulse' : ''
              }`}
              style={{ 
                background: isOutOfStock ? "var(--color-danger-soft)" : isLowStock ? "var(--color-stock-low-soft)" : "var(--color-surface-2)",
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xl"
                style={{ 
                  background: isOutOfStock ? "var(--color-danger)" : isLowStock ? "var(--color-stock-low)" : "var(--color-surface-3)",
                }}
              >
                {product.img
                  ? <img src={product.img} alt="" className="w-full h-full rounded-xl object-cover" />
                  : isOutOfStock ? "🚫" : "⚠️"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                  {product.product_name}
                </p>
                <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
                  {product.sku ?? `SKU-${product.id?.slice(0, 6).toUpperCase()}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>Stock</p>
                <p className="text-base font-extrabold" style={{ color: stockColor(stock) }}>
                  {stock}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      
      {allItems.length >= 8 && (
        <div className="mt-3 pt-2 text-center text-[10px]" style={{ color: "var(--color-text-faint)" }}>
          Showing {allItems.length} of {totalAlerts} items
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   RECENT ACTIVITY PANEL (enhanced)
───────────────────────────────────────────────────────────── */
interface ActivityItem {
  icon: string;
  iconBg: string;
  text: React.ReactNode;
  time: string;
}

interface RecentActivityPanelProps {
  warehouseId?: string;
}

export const RecentActivityPanel = ({ warehouseId }: RecentActivityPanelProps) => {
  const companyId = useSelector((s: RootState) => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

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
        
        movements = movements.slice(0, 6);
        
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
                <strong style={{ color: "var(--color-text-primary)" }}>{movement.productName}</strong>
                <span style={{ color: "var(--color-text-muted)" }}> {action} </span>
                <strong style={{ color: isPositive ? "var(--color-success)" : "var(--color-danger)" }}>
                  {Math.abs(movement.quantity)}
                </strong>
                <span style={{ color: "var(--color-text-muted)" }}> units</span>
                {movement.type && (
                  <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded" style={{ 
                    background: "var(--color-surface-3)", 
                    color: "var(--color-text-faint)" 
                  }}>
                    {movement.type.replace("_", " ")}
                  </span>
                )}
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

  if (loading) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center min-h-[220px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-brand-primary)" }} />
        <p className="text-xs mt-3" style={{ color: "var(--color-text-muted)" }}>Loading activity...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div
        className="rounded-xl p-6 flex flex-col items-center justify-center min-h-[220px]"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-border-soft)" }}
      >
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "var(--color-surface-3)" }}>
            <MdSwapHoriz size={28} style={{ color: "var(--color-text-faint)" }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
            No Recent Activity
          </p>
          <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: "var(--color-text-muted)" }}>
            {warehouseId 
              ? `No activity in this warehouse yet.` 
              : `Activity will appear here when you add products, make transfers, or update inventory.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-5 flex flex-col transition-all hover:shadow-md"
      style={{ 
        background: "var(--color-surface-1)", 
        border: "1px solid var(--color-border-soft)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-muted)" }}>
            Recent Activity
          </p>
          {warehouseId && (
            <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>in {warehouseId}</p>
          )}
        </div>
        <button 
          className="text-xs flex items-center gap-1 transition-all hover:gap-2" 
          style={{ color: "var(--color-brand-primary-soft)" }}
        >
          View All <MdArrowForward size={12} />
        </button>
      </div>

      <ul className="space-y-3.5">
        {activities.map((a, i) => (
          <li key={i} className="flex items-start gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base transition-all group-hover:scale-105"
              style={{ background: a.iconBg }}
            >
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {a.text}
              </p>
              <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--color-text-faint)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-text-faint)" }} />
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
   PRODUCTS OVERVIEW TABLE (enhanced)
───────────────────────────────────────────────────────────── */
interface ProductsTableProps {
  onEdit?: (id: string) => void;
  onAdd?:  () => void;
  onSell?: (product: Product) => void;
  readOnly?: boolean;
  productsOverride?: Product[];
}

export const ProductsTable = ({ onEdit, onAdd, onSell, readOnly = false, productsOverride }: ProductsTableProps) => {
  const reduxProducts = useSelector((s: RootState) => s.stock.productData);
  const products = productsOverride ?? reduxProducts;

  if (products.length === 0) {
    return (
      <div
        className="rounded-xl flex flex-col items-center justify-center min-h-[320px]"
        style={{ 
          background: "var(--color-surface-1)", 
          border: "2px dashed var(--color-border-soft)",
        }}
      >
        <div className="text-center p-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 animate-float" style={{ background: "var(--color-surface-3)" }}>
            <MdInventory2 size={40} style={{ color: "var(--color-text-faint)" }} />
          </div>
          <p className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
            No Products Yet
          </p>
          <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: "var(--color-text-muted)" }}>
            Start by adding your first product to track inventory and stock levels.
          </p>
          {onAdd && (
            <button
              onClick={onAdd}
              className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105 hover:shadow-lg"
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
    if (qty === 0)  return { 
      label: "Out of Stock", 
      bg: "var(--color-stock-out-soft)",   
      text: "var(--color-stock-out)",   
      border: "var(--color-stock-out-border)" 
    };
    if (qty <= 5)   return { 
      label: "Low Stock",    
      bg: "var(--color-stock-low-soft)",   
      text: "var(--color-stock-low)",   
      border: "var(--color-stock-low-border)" 
    };
    return { 
      label: "In Stock",           
      bg: "var(--color-stock-in-soft)",    
      text: "var(--color-stock-in)",    
      border: "var(--color-stock-in-border)" 
    };
  };

  return (
    <div
      className="rounded-xl flex flex-col transition-all hover:shadow-md"
      style={{ 
        background: "var(--color-surface-1)", 
        border: "1px solid var(--color-border-soft)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Table header with enhanced search */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-primary)" }}>
          Products Overview
          <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-text-faint)" }}>
            ({products.length} items)
          </span>
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs transition-all focus-within:ring-2 focus-within:ring-brand-primary/20"
            style={{
              background: "var(--color-input-bg)",
              border: "1px solid var(--color-input-border)",
              color: "var(--color-input-placeholder)",
            }}
          >
            <MdSearch size={14} style={{ color: "var(--color-input-icon)" }} />
            <input
              type="text"
              placeholder="Search products..."
              className="bg-transparent outline-none text-xs min-w-[120px]"
              style={{ color: "var(--color-input-text)" }}
            />
          </div>
          <button
            className="h-9 px-3.5 rounded-lg text-xs flex items-center gap-1.5 transition-all hover:bg-surface-3"
            style={{
              background: "var(--color-surface-3)",
              color: "var(--color-text-muted)",
              border: "1px solid var(--color-border-soft)",
            }}
          >
            <MdFilterList size={14} /> Filters
          </button>
          <button className="w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:bg-surface-3" style={{ color: "var(--color-text-muted)" }}>
            <MdMoreVert size={18} />
          </button>
        </div>
      </div>

      {/* Table with enhanced styling */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
              {["", "SKU", "Product Name", "Category", "Price", "Stock", "Status", "Actions"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold uppercase tracking-wider text-[10px]"
                  style={{ color: "var(--color-text-faint)" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((item, index) => {
              const product = item as Product;
              const status = statusInfo(product.product_Qty ?? 0);
              return (
                <tr
                  key={product.id}
                  className="transition-all duration-200"
                  style={{ 
                    borderBottom: index < visible.length - 1 ? "1px solid var(--color-border-subtle)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--color-surface-2)";
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.001)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                  }}
                >
                  <td className="px-4 py-3">
                    <input 
                      type="checkbox" 
                      className="accent-indigo-500 w-4 h-4 rounded cursor-pointer transition-all hover:scale-110" 
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--color-text-muted)" }}>
                    {product.sku || `SKU-${product.id?.slice(0, 6).toUpperCase()}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm overflow-hidden"
                        style={{ background: "var(--color-surface-3)" }}
                      >
                        {product.img ? 
                          <img src={product.img} className="w-full h-full rounded-lg object-cover" alt="" /> : 
                          "📦"
                        }
                      </div>
                      <span className="font-medium truncate max-w-[140px]" style={{ color: "var(--color-text-primary)" }}>
                        {product.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-text-secondary)" }}>
                    {product.categoryName || "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    ${Number(product.product_Price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-text-primary)" }}>
                    {product.product_Qty}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold inline-flex items-center gap-1"
                      style={{ 
                        background: status.bg, 
                        color: status.text, 
                        border: `1px solid ${status.border}` 
                      }}
                    >
                      {status.label === "Out of Stock" && <MdError size={10} />}
                      {status.label === "Low Stock" && <MdWarning size={10} />}
                      {status.label === "In Stock" && <MdCheckCircle size={10} />}
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {readOnly ? (
                      <span className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>View only</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {onSell && product.product_Qty > 0 && !readOnly && (
                          <button
                            onClick={() => onSell(product)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 hover:bg-green-500/10"
                            style={{ color: "var(--color-success)" }}
                            title="Sell product"
                          >
                            <MdAttachMoney size={14} />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(product.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:scale-110 hover:bg-blue-500/10"
                            style={{ color: "var(--color-brand-primary-soft)" }}
                            title="Edit product"
                          >
                            <FiEdit2 size={14} />
                          </button>
                        )}
                        <button 
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-3" 
                          style={{ color: "var(--color-text-muted)" }}
                          title="More options"
                        >
                          <FiMoreHorizontal size={14} />
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

      {/* Enhanced Pagination */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-xs"
        style={{
          borderTop: "1px solid var(--color-border-subtle)",
          color: "var(--color-text-muted)",
        }}
      >
        <span>
          Showing <strong style={{ color: "var(--color-text-primary)" }}>1</strong> to{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{Math.min(PAGE_SIZE, products.length)}</strong> of{" "}
          <strong style={{ color: "var(--color-text-primary)" }}>{products.length}</strong> products
        </span>
        <div className="flex items-center gap-1">
          <button className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-surface-3 disabled:opacity-30" disabled>
            ‹
          </button>
          {["1", "2", "3", "4", "5", "…", "9"].map((p, i) => (
            <button
              key={i}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                p === "1" 
                  ? "hover:scale-105" 
                  : "hover:bg-surface-3"
              }`}
              style={
                p === "1"
                  ? { background: "var(--color-brand-primary)", color: "white", boxShadow: "var(--shadow-glow)" }
                  : { color: "var(--color-text-muted)" }
              }
            >
              {p}
            </button>
          ))}
          <button className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-surface-3">
            ›
          </button>
        </div>
      </div>
    </div>
  );
};