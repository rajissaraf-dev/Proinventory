// DashboardHeader.tsx - Full responsive version

import { useState, useEffect, useRef } from "react";
import { MdNotifications, MdHelp, MdLogout, MdSettings, MdPerson } from "react-icons/md";
import { useSelector } from "react-redux";
import { RootState } from "../../app/store";
import { NotificationService } from "../../services/notification.service";
import useAppSelector from "../../hooks/useAppSelector";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logOut } from "../../services/firebase";
import { clearCurrentUser } from "../../features/auth/authSlice";
import { clearCompany } from "../../features/company/companySlice";

type Timeout = ReturnType<typeof setTimeout>;

interface DashboardHeaderProps {
  notificationCount?: number;
  onNotificationCountChange?: (count: number) => void;
  onNotificationClick?: () => void;
  isSidebarCollapsed?: boolean;
  onMenuClick?: () => void;
}

const DashboardHeader = ({ 
  notificationCount = 0,
  onNotificationCountChange,
  onNotificationClick,
  isSidebarCollapsed = false,
  onMenuClick,
}: DashboardHeaderProps) => {
  const [localCount, setLocalCount] = useState(notificationCount);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const authUser = useSelector((s: RootState) => s.auth.user);
  const profile = useSelector((s: RootState) => s.auth.profile);
  const companyId = useAppSelector(s => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const intervalRef = useRef<Timeout | null>(null);
  const retryCount = useRef(0);
  const maxRetries = 3;
  const menuRef = useRef<HTMLDivElement>(null);

  const sidebarWidth = isSidebarCollapsed ? 64 : 220;

  const loadCount = async () => {
    if (!companyId) return;
    
    try {
      const count = await NotificationService.getUnreadCount(companyId);
      setLocalCount(count);
      if (onNotificationCountChange) {
        onNotificationCountChange(count);
      }
      retryCount.current = 0;
    } catch (err) {
      console.error("Failed to load notification count:", err);
      
      if (retryCount.current < maxRetries) {
        retryCount.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 10000);
        console.log(`Retrying in ${delay}ms (attempt ${retryCount.current}/${maxRetries})`);
        setTimeout(loadCount, delay);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!companyId) return;
    
    loadCount();
    intervalRef.current = setInterval(loadCount, 60000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const displayCount = notificationCount || localCount;

  const handleNotificationClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
    } else {
      navigate("/dashboard?tab=notifications");
    }
  };

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

  const getUserInitials = () => {
    if (profile?.displayName) {
      return profile.displayName
        .split(" ")
        .map(word => word[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return authUser?.email?.[0]?.toUpperCase() ?? "U";
  };

  const getUserDisplayName = () => {
    return profile?.displayName ?? authUser?.email?.split("@")[0] ?? "User";
  };

  const getUserRole = () => {
    const role = profile?.role ?? authUser?.role ?? "staff";
    const roleLabels: Record<string, string> = {
      company_owner: "Owner",
      company_admin: "Admin",
      staff: "Staff",
    };
    return roleLabels[role] ?? role;
  };

  return (
    <header
      className="fixed top-0 z-30 flex items-center gap-4 px-5 h-14 transition-all duration-300"
      style={{
        left: `${sidebarWidth}px`,
        right: 0,
        background: "var(--color-bg-header)",
        borderBottom: "1px solid var(--color-border-subtle)",
        backdropFilter: "blur(8px)",
        width: `calc(100% - ${sidebarWidth}px)`,
      }}
    >
      {/* App Brand / Breadcrumb */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg"
            style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)", border: "1px solid var(--color-border-soft)" }}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        )}
        <div className="hidden sm:block">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
            Dashboard
          </p>
          <p className="text-[10px]" style={{ color: "var(--color-text-faint)" }}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-all hover:scale-105"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border-soft)",
          }}
          aria-label="Notifications"
          onClick={handleNotificationClick}
        >
          <MdNotifications size={18} />
          {displayCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold rounded-full px-1 animate-pulse"
              style={{ background: "var(--color-danger)", color: "white" }}
            >
              {displayCount > 99 ? '99+' : displayCount}
            </span>
          )}
        </button>

        <button
          className="hidden sm:flex w-9 h-9 items-center justify-center rounded-lg transition-colors hover:bg-surface-3"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border-soft)",
          }}
          aria-label="Help"
        >
          <MdHelp size={18} />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg transition-all hover:bg-surface-2 group"
            style={{
              background: showUserMenu ? "var(--color-surface-3)" : "transparent",
              border: "1px solid transparent",
            }}
            aria-label="User menu"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 transition-all group-hover:ring-3 shrink-0"
              style={{
                background: "var(--color-brand-primary)",
                color: "white",
                borderColor: "var(--color-border-brand)",
              }}
            >
              {getUserInitials()}
            </div>
            
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold leading-none" style={{ color: "var(--color-text-primary)" }}>
                {getUserDisplayName()}
              </p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: "var(--color-text-faint)" }}>
                {getUserRole()}
              </p>
            </div>
            
            <span
              className="hidden sm:block text-xs transition-transform"
              style={{ 
                color: "var(--color-text-faint)",
                transform: showUserMenu ? "rotate(180deg)" : "rotate(0deg)"
              }}
            >
              ▼
            </span>
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl py-2 shadow-lg animate-slideDown"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border-soft)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border-soft)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                  {getUserDisplayName()}
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                  {authUser?.email}
                </p>
                <span
                  className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize bg-white"
                  style={{
                    color: "var(--color-brand-primary)",
                  }}
                >
                  {getUserRole()}
                </span>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/dashboard");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-surface-3"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <MdPerson size={16} style={{ color: "var(--color-text-faint)" }} />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate("/business-profile");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors hover:bg-surface-3"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  <MdSettings size={16} style={{ color: "var(--color-text-faint)" }} />
                  Settings
                </button>
              </div>

              <div className="border-t" style={{ borderColor: "var(--color-border-soft)" }}>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors hover:bg-danger-soft"
                  style={{ color: "var(--color-danger)" }}
                >
                  <MdLogout size={16} />
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;