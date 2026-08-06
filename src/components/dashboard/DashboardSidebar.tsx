import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  MdDashboard, MdInventory, MdShoppingCart, MdReceipt,
  MdPeople, MdWarehouse, MdSwapHoriz, MdBarChart,
  MdDescription, MdExtension, MdNotifications,
  MdMessage, MdSettings, MdLock, MdLogout, MdChevronLeft,
  MdChevronRight,
} from "react-icons/md";
import { logOut } from "../../services/firebase";
import { clearCurrentUser } from "../../features/auth/authSlice";
import { clearCompany } from "../../features/company/companySlice";
import { useDispatch } from "react-redux";
import Logo from "../../assets/img/stocktrack-logo.png";
import { NotificationService } from "../../services/notification.service";
import useAppSelector from "../../hooks/useAppSelector";
import useRole from "../../hooks/useRole";
import useCompanySettings from "../../hooks/useCompanySettings";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  to?: string;
  badge?: number;
  onClick?: () => void;
  disabled?: boolean;
}

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeView?: "dashboard" | "add-product";
  notificationCount?: number;
  messageCount?: number;
  onAlertsClick?: () => void;
}

const DashboardSidebar = ({
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
  const { settings } = useCompanySettings(companyId);
  const { isOwner } = useRole();
  const brandName = settings.companyName?.trim() || "ProInventory";

  useEffect(() => {
    if (!companyId) return;
    
    const loadCount = async () => {
      try {
        const count = await NotificationService.getUnreadCount(companyId);
        setLocalNotificationCount(count);
      } catch (error) {
        console.error("Failed to load notification count:", error);
      }
    };
    
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, [companyId]);

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

  const handleMobileToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const closeMobileSidebar = () => {
    setMobileOpen(false);
  };

  const mainNav: NavItem[] = [
    { label: "Dashboard", icon: <MdDashboard size={20} />, to: "/dashboard" },
    { label: "Products", icon: <MdInventory size={20} />, to: "/products" },
    { label: "Orders", icon: <MdShoppingCart size={20} />, to: "/dashboard" },
    { label: "Purchase Orders", icon: <MdReceipt size={20} />, to: "/dashboard" },
    { label: "Suppliers", icon: <MdPeople size={20} />, to: "/dashboard" },
    { label: "Warehouses", icon: <MdWarehouse size={20} />, to: "/dashboard" },
    { label: "Transfers", icon: <MdSwapHoriz size={20} />, to: "/dashboard" },
    { label: "Analytics", icon: <MdBarChart size={20} />, to: "/dashboard" },
    { label: "Reports", icon: <MdDescription size={20} />, to: "/dashboard" },
    { label: "Integrations", icon: <MdExtension size={20} />, to: "/dashboard" },
  ];

  const bottomNav: NavItem[] = [
    { 
      label: "Notifications", 
      icon: <MdNotifications size={20} />, 
      onClick: () => {
        if (onAlertsClick) {
          onAlertsClick();
        } else {
          navigate("/dashboard?tab=notifications");
        }
        closeMobileSidebar();
      }, 
      badge: displayCount
    },
    { 
      label: "Warehouse", 
      icon: <MdMessage size={20} />, 
      onClick: () => {
        navigate("/warehouse");
        closeMobileSidebar();
      }, 
      badge: messageCount 
    },
    { 
      label: "Settings", 
      icon: isOwner ? <MdSettings size={20} /> : (
        <span className="inline-flex items-center gap-1">
          <MdSettings size={20} />
          <MdLock size={12} />
        </span>
      ), 
      onClick: isOwner ? () => {
        navigate("/dashboard?tab=settings");
        closeMobileSidebar();
      } : undefined,
      disabled: !isOwner,
    },
    { label: "Log Out", icon: <MdLogout size={20} />, onClick: () => {
      handleLogout();
      closeMobileSidebar();
    }},
  ];

  // ─── Determine if labels should be shown ───
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  
  // On mobile: show labels only when mobileOpen is true
  // On desktop: show labels based on collapsed prop
  const shouldShowLabels = isMobile ? mobileOpen : !collapsed;

  // ─── Determine sidebar width ───
  const sidebarWidth = isMobile ? (mobileOpen ? 260 : 56) : (collapsed ? 56 : 220);

  const NavLink = ({ item }: { item: NavItem }) => {
    const isProducts = item.label === "Products";
    const isDashboard = item.label === "Dashboard";
    const active =
      (isDashboard && activeView === "dashboard" && location.pathname === item.to) ||
      (isProducts && activeView === "add-product");
    
    const handleClick = () => {
      if (item.to) {
        closeMobileSidebar();
      }
      if (item.onClick) {
        item.onClick();
      }
    };

    const showLabel = shouldShowLabels;

    return (
      <li>
        {item.to ? (
          <Link
            to={item.to}
            onClick={closeMobileSidebar}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group"
            style={{
              background: active ? "var(--color-nav-active-bg)" : "transparent",
              color: active ? "var(--color-nav-item-active)" : "var(--color-nav-item)",
              borderLeft: active ? "2px solid var(--color-brand-primary-soft)" : "2px solid transparent",
              justifyContent: isMobile && !showLabel ? "center" : "flex-start",
            }}
          >
            <span style={{ color: active ? "var(--color-nav-icon-active)" : "var(--color-nav-icon)" }}>
              {item.icon}
            </span>
            {showLabel && <span className="truncate">{item.label}</span>}
            {showLabel && item.badge && item.badge > 0 && (
              <span
                className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {!showLabel && item.badge && item.badge > 0 && (
              <span
                className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full"
                style={{ background: "var(--color-danger)", color: "white" }}
              >
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
            {/* Tooltip when labels are hidden on desktop */}
            {!showLabel && !isMobile && (
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
            onClick={item.disabled ? undefined : handleClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative"
            style={{
              color: item.disabled ? "var(--color-text-faint)" : "var(--color-nav-item)",
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.6 : 1,
              justifyContent: isMobile && !showLabel ? "center" : "flex-start",
            }}
            disabled={item.disabled}
          >
            <span style={{ color: item.disabled ? "var(--color-text-faint)" : "var(--color-nav-icon)" }}>{item.icon}</span>
            {showLabel && <span>{item.label}</span>}
            {!showLabel && !isMobile && (
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
    <div className="flex flex-col h-full w-full">
      {/* Logo row */}
      <div
        className="flex items-center justify-between px-3 py-4 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border-subtle)" }}
      >
        <Link to="/" className="flex items-center gap-2 min-w-0" onClick={closeMobileSidebar}>
          <img src={settings.logoUrl || Logo} alt={brandName} className="w-8 h-8 rounded-lg shrink-0 object-cover" />
          {shouldShowLabels && (
            <span className="text-white font-bold text-base truncate">{brandName}</span>
          )}
        </Link>
        {/* Desktop toggle - hidden on mobile */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex w-6 h-6 items-center justify-center rounded transition-colors shrink-0"
          style={{ color: "var(--color-nav-icon)" }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <MdChevronRight size={16} /> : <MdChevronLeft size={16} />}
        </button>
      </div>

      {/* Main nav */}
      <nav 
        className="flex-1 overflow-y-auto px-2 py-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--color-border-soft) transparent',
        }}
      >
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

        {/* Collapse toggle label - desktop only */}
        {!collapsed && !isMobile && (
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
      {/* ─── CSS Animations ─── */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>

      {/* Mobile Toggle Button - Higher z-index than sidebar */}
      <button
        className="md:hidden fixed top-3 left-3 z-[100] w-9 h-9 flex items-center justify-center rounded-lg shadow-md"
        style={{ 
          background: "var(--color-surface-2)", 
          color: "var(--color-text-primary)",
          border: "1px solid var(--color-border-soft)",
        }}
        onClick={handleMobileToggle}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <MdChevronLeft size={20} /> : <MdChevronRight size={20} />}
      </button>

      {/* ─── Mobile Backdrop Overlay ─── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[98]"
          onClick={closeMobileSidebar}
          style={{
            animation: 'fadeIn 0.2s ease-out',
          }}
        />
      )}

      {/* ─── Sidebar Container ─── */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen transition-all duration-300 z-[99] ${
          isMobile && !mobileOpen ? "-translate-x-full md:translate-x-0" : "translate-x-0"
        }`}
        style={{
          width: sidebarWidth,
          background: "var(--color-bg-sidebar)",
          borderRight: "1px solid var(--color-border-subtle)",
          boxShadow: isMobile && mobileOpen ? "var(--shadow-card)" : "none",
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

export default DashboardSidebar;