import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBars, FaTimes, FaChevronDown } from "react-icons/fa";
import { useAuth, logOut } from "../../services/firebase";
import { clearCurrentUser } from "../../features/auth/authSlice";
import { clearCompany } from "../../features/company/companySlice";
import { useDispatch } from "react-redux";
import Logo from "../../assets/img/stocktrack-logo.png";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  {
    label: "Solutions",
    children: ["Retail", "Wholesale", "Manufacturing", "E-commerce"],
  },
  { label: "Pricing", href: "#pricing" },
  {
    label: "Resources",
    children: ["Documentation", "API Reference", "Blog", "Changelog"],
  },
  {
    label: "Company",
    children: ["About", "Careers", "Contact", "Press"],
  },
];

const Navbar = () => {
  const navigate   = useNavigate();
  const dispatch   = useDispatch();
  const currentUser = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleLogout = async () => {
    await logOut();
    dispatch(clearCurrentUser());
    dispatch(clearCompany());
    sessionStorage.removeItem("currentUser");
    navigate("/");
  };

  const toggleDropdown = (label: string) =>
    setOpenDropdown((p) => (p === label ? null : label));

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(7,11,20,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link to="/" className="flex items-center shrink-0">
            <img src={Logo} alt="StockTrack" className="w-12 h-12 rounded-lg" />
            <span className="text-white font-bold text-lg tracking-tight">
              Pro<span style={{ color: "var(--color-brand-primary-soft)" }}>Inventory</span>
            </span>
          </Link>

          {/* ── Desktop nav links ── */}
          <ul className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((item) =>
              item.children ? (
                <li key={item.label} className="relative">
                  <button
                    onClick={() => toggleDropdown(item.label)}
                    className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{ color: "var(--color-text-secondary)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.color =
                        "var(--color-text-primary)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.color =
                        "var(--color-text-secondary)")
                    }
                  >
                    {item.label}
                    <FaChevronDown
                      className="text-[10px] transition-transform"
                      style={{
                        transform:
                          openDropdown === item.label
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                      }}
                    />
                  </button>

                  {openDropdown === item.label && (
                    <div
                      className="absolute top-full mt-2 left-0 w-44 rounded-xl py-1 z-50"
                      style={{
                        background: "var(--color-surface-elevated)",
                        border: "1px solid var(--color-border-soft)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {item.children.map((child) => (
                        <button
                          key={child}
                          className="w-full text-left px-4 py-2 text-sm transition-colors"
                          style={{ color: "var(--color-text-secondary)" }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.color =
                              "var(--color-text-primary)";
                            (e.currentTarget as HTMLElement).style.background =
                              "var(--color-nav-active-bg)";
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.color =
                              "var(--color-text-secondary)";
                            (e.currentTarget as HTMLElement).style.background =
                              "transparent";
                          }}
                        >
                          {child}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ) : (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="px-3 py-2 rounded-md text-sm font-medium transition-colors"
                    style={{ color: "var(--color-text-secondary)" }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLElement).style.color =
                        "var(--color-text-primary)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLElement).style.color =
                        "var(--color-text-secondary)")
                    }
                  >
                    {item.label}
                  </a>
                </li>
              )
            )}
          </ul>

          {/* ── Desktop CTA ── */}
          <div className="hidden lg:flex items-center gap-3">
            {currentUser ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "var(--color-text-secondary)" }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "var(--color-text-primary)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.color =
                      "var(--color-text-secondary)")
                  }
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{
                    background: "var(--color-brand-primary)",
                    color: "var(--color-button-primary-text)",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--color-brand-primary-hover)")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "var(--color-brand-primary)")
                  }
                >
                  Start Free Trial
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile hamburger ── */}
          <button
            className="lg:hidden p-2 rounded-md"
            style={{ color: "var(--color-text-secondary)" }}
            onClick={() => setMobileOpen((p) => !p)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <FaTimes size={18} /> : <FaBars size={18} />}
          </button>
        </div>

        {/* ── Mobile menu ── */}
        {mobileOpen && (
          <div
            className="lg:hidden py-4 space-y-1"
            style={{ borderTop: "1px solid var(--color-border-soft)" }}
          >
            {NAV_LINKS.map((item) => (
              <div key={item.label}>
                {item.children ? (
                  <>
                    <button
                      onClick={() => toggleDropdown(item.label)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      {item.label}
                      <FaChevronDown
                        className="text-[10px]"
                        style={{
                          transform:
                            openDropdown === item.label
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                        }}
                      />
                    </button>
                    {openDropdown === item.label &&
                      item.children.map((child) => (
                        <button
                          key={child}
                          className="w-full text-left pl-6 py-2 text-sm"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {child}
                        </button>
                      ))}
                  </>
                ) : (
                  <a
                    href={item.href}
                    className="block px-3 py-2 rounded-md text-sm font-medium"
                    style={{ color: "var(--color-text-secondary)" }}
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </a>
                )}
              </div>
            ))}

            <div
              className="flex flex-col gap-2 pt-3 mt-3"
              style={{ borderTop: "1px solid var(--color-border-soft)" }}
            >
              <Link
                to="/login"
                className="px-4 py-2 text-center rounded-lg text-sm font-medium"
                style={{
                  color: "var(--color-text-secondary)",
                  border: "1px solid var(--color-border-medium)",
                }}
                onClick={() => setMobileOpen(false)}
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-center rounded-lg text-sm font-semibold"
                style={{
                  background: "var(--color-brand-primary)",
                  color: "white",
                }}
                onClick={() => setMobileOpen(false)}
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
