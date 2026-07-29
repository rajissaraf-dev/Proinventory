import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MdDashboard, MdInventory, MdShoppingCart, MdReceipt,
  MdPeople, MdWarehouse, MdSwapHoriz, MdBarChart,
  MdDescription, MdExtension, MdNotifications,
  MdMessage, MdSettings, MdLogout, MdChevronLeft,
  MdMenu, MdAdd,
} from "react-icons/md";
import { logOut } from "../../services/firebase";
import { clearCurrentUser } from "../../features/auth/authSlice";
import { clearCompany } from "../../features/company/companySlice";
import { useDispatch } from "react-redux";
import Logo from "../../assets/img/stocktrack-logo.png";
import { NotificationService } from "../../services/notification.service";
import useAppSelector from "../../hooks/useAppSelector";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  badge?: number;
  onClick?: () => void;
}

interface DashboardSidebarProps {
  onNewItem: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeView?: "dashboard" | "add-product";
  notificationCount?: number;
  messageCount?: number;
  onAlertsClick?: () => void;
}

const DashboardSidebar = ({
  onNewItem,
  collapsed,
  onToggleCollapse,
  activeView = "dashboard",
  notificationCount = 0,
  messageCount = 0,
  onAlertsClick,
}: DashboardSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [localNotificationCount, setLocalNotificationCount] = useState(notificationCount);
  const companyId = useAppSelector(s => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";

  // Load notification count periodically with better error handling
  useEffect(() => {
    if (!companyId) return;
    
    const loadCount = async () => {
      try {
        const count = await NotificationService.getUnreadCount(companyId);
        setLocalNotificationCount(count);
      } catch (error) {
        console.error("Failed to load notification count:", error);
        // Keep existing count, don't reset to 0 on error
      }
    };
    
    // Initial load
    loadCount();
    
    // Refresh every 60 seconds instead of 30 to reduce load
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, [companyId]);

  // Use local count if notificationCount prop is not provided
  const displayCount = notificationCount || localNotificationCount;

  const handleLogout = async () => {
    try {
      await logOut();
      dispatch(clearCurrentUser());
      dispatch(clearCompany());
      sessionStorage.removeItem("currentUser");
      localStorage.removeItem("currentUser");
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      alert((err as Error).message || "Failed to log out. Please try again.");
    }
  };

  const mainNav: NavItem[] = [
    { label: "Dashboard", icon: <MdDashboard size={18} />, to: "/dashboard" },
    { label: "Products", icon: <MdInventory size={18} />, to: "/dashboard" },
    { label: "Orders", icon: <MdShoppingCart size={18} />, to: "/dashboard" },
    { label: "Purchase Orders", icon: <MdReceipt size={18} />, to: "/dashboard" },
    { label: "Suppliers", icon: <MdPeople size={18} />, to: "/dashboard" },
    { label: "Warehouses", icon: <MdWarehouse size={18} />, to: "/dashboard" },
    { label: "Transfers", icon: <MdSwapHoriz size={18} />, to: "/dashboard" },
    { label: "Analytics", icon: <MdBarChart size={18} />, to: "/dashboard" },
    { label: "Reports", icon: <MdDescription size={18} />, to: "/dashboard" },
    { label: "Integrations", icon: <MdExtension size={18} />, to: "/dashboard" },
  ];

  // Use displayCount for the badge
  const bottomNav: NavItem[] = [
    { 
      label: "Notifications", 
      icon: <MdNotifications size={18} />, 
      onClick: () => {
        if (onAlertsClick) {
          onAlertsClick();
        } else {
          navigate("/dashboard?tab=notifications");
        }
      }, 
      badge: displayCount
    },
    { label: "Messages", icon: <MdMessage size={18} />, to: "/dashboard", badge: messageCount },
    { label: "Settings", icon: <MdSettings size={18} />, to: "/dashboard" },
    { label: "Log Out", icon: <MdLogout size={18} />, onClick: handleLogout },
  ];

  const NavLink = ({ item }: { item: NavItem }) => {
    const isProducts = item.label === "Products";
    const isDashboard = item.label === "Dashboard";
    const active =
      (isDashboard && activeView === "dashboard" && location.pathname === item.to) ||
      (isProducts && activeView === "add-product");
    return (
      <li>
        {item.to ? (
          <Link
            to={item.to}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all relative group"
            style={{
              background: active ? "var(--color-nav-active-bg)" : "transparent",
              color: active ? "var(--color-nav-item-active)" : "var(--color-nav-item)",
              borderLeft: active ? "2px solid var(--color-brand-primary-soft)" : "2px solid transparent",
            }}
          >
            <span style={{ color: active ? "var(--color-nav-icon-active)" : "var(--color-nav-icon)" }}>
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.badge && item.badge > 0 && (
              <span
                className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {collapsed && item.badge && item.badge > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {/* Tooltip when collapsed */}
            {collapsed && (
              <span
                className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity"
                style={{ background: "var(--color-surface-4)", color: "var(--color-text-primary)" }}
              >
                {item.label}
              </span>
            )}
          </Link>
        ) : (
          <button
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative"
            style={{ color: "var(--color-nav-item)" }}
          >
            <span style={{ color: "var(--color-nav-icon)" }}>{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
            {collapsed && (
              <span
                className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity"
                style={{ background: "var(--color-surface-4)", color: "var(--color-text-primary)" }}
              >
                {item.label}
              </span>
            )}
          </button>
        )}
      </li>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-3 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <img src={Logo} alt="StockTrack" className="w-7 h-7 rounded-lg shrink-0" />
          {!collapsed && (
            <span className="text-white font-bold text-base truncate">
              Pro<span style={{ color: "var(--color-brand-primary-soft)" }}>Inventory</span>
            </span>
          )}
        </Link>
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-6 h-6 items-center justify-center rounded transition-colors shrink-0"
          style={{ color: "var(--color-nav-icon)" }}
          aria-label="Toggle sidebar"
        >
          {collapsed ? <MdMenu size={16} /> : <MdChevronLeft size={16} />}
        </button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-2 py-3">
        <ul className="space-y-0.5">
          {mainNav.map((item) => <NavLink key={item.label} item={item} />)}
        </ul>
      </nav>

      {/* Bottom nav */}
      <div
        className="px-2 py-3 shrink-0"
        style={{ borderTop: "1px solid var(--color-border-subtle)" }}
      >
        <ul className="space-y-0.5">
          {bottomNav.map((item) => <NavLink key={item.label} item={item} />)}
        </ul>

        {/* Upgrade to Pro card */}
        {!collapsed && (
          <div
            className="mx-2 mb-3 p-3 rounded-xl"
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%)",
              border: "1px solid var(--color-border-brand)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">👑</span>
              <p className="text-xs font-bold" style={{ color: "var(--color-text-primary)" }}>
                Upgrade to Pro
              </p>
            </div>
            <p className="text-[11px] mb-3 leading-snug" style={{ color: "var(--color-text-muted)" }}>
              Unlock advanced features and reports.
            </p>
            <button
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: "var(--color-brand-primary)",
                color: "white",
              }}
            >
              Upgrade Now
              <span>→</span>
            </button>
          </div>
        )}

        {/* Collapse toggle label */}
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all"
            style={{ color: "var(--color-text-faint)" }}
          >
            <MdChevronLeft size={14} />
            <span>Collapse</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-lg"
        style={{ background: "var(--color-surface-3)", color: "var(--color-text-primary)" }}
        onClick={() => setMobileOpen((p) => !p)}
        aria-label="Open sidebar"
      >
        <MdMenu size={18} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 h-screen z-40 transition-all duration-300 overflow-hidden"
        style={{
          width: collapsed ? "64px" : "220px",
          background: "var(--color-bg-sidebar)",
          borderRight: "1px solid var(--color-border-subtle)",
          transform: mobileOpen ? "translateX(0)" : undefined,
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default DashboardSidebar;