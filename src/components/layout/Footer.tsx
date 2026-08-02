import { useState } from "react";
import { Link } from "react-router-dom";
import { FaTwitter, FaLinkedin, FaFacebook, FaInstagram } from "react-icons/fa";
import Logo from "../../assets/img/stocktrack-logo.png";
import useAppSelector from "../../hooks/useAppSelector";
import useCompanySettings from "../../hooks/useCompanySettings";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Integrations", href: "#" },
  { label: "Changelog", href: "#" },
];

const SOLUTIONS_LINKS = [
  { label: "Retail", href: "#" },
  { label: "E-commerce", href: "#" },
  { label: "Wholesale", href: "#" },
  { label: "Manufacturing", href: "#" },
  { label: "API access", href: "#" },
];

const RESOURCES_LINKS = [
  { label: "Blog", href: "#" },
  { label: "Guides", href: "#" },
  { label: "Documentation", href: "#" },
  { label: "Webinars", href: "#" },
];

const COMPANY_LINKS = [
  { label: "About Us", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Security", href: "#" },
  { label: "Partners", href: "#" },
  { label: "Contact Us", href: "#" },
];

const SOCIALS = [
  { icon: <FaTwitter size={14} />, href: "https://twitter.com", label: "Twitter" },
  { icon: <FaLinkedin size={14} />, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: <FaFacebook size={14} />, href: "https://facebook.com", label: "Facebook" },
  { icon: <FaInstagram size={14} />, href: "https://instagram.com", label: "Instagram" },
];

const LEGAL_LINKS = ["Privacy Policy", "Terms of Service", "Cookie Policy"];

const FooterCol = ({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) => (
  <div>
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-4"
      style={{ color: "var(--color-text-faint)" }}
    >
      {title}
    </p>
    <ul className="space-y-3">
      {links.map(({ label, href }) => (
        <li key={label}>
          <a
            href={href}
            className="text-sm transition-colors"
            style={{ color: "var(--color-text-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--color-text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--color-text-muted)")
            }
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const Footer = () => {
  const [email, setEmail] = useState("");
  const companyId = useAppSelector((s) => s.auth.profile?.companyId ?? s.auth.user?.companyId) ?? "";
  const { settings } = useCompanySettings(companyId);
  const brandName = settings.companyName?.trim() || "ProInventory";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    setEmail("");
  };

  return (
    <footer
      style={{
        background: "var(--color-bg-sidebar)",
        borderTop: "1px solid var(--color-border-subtle)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* ── Top grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-10 mb-14">

          {/* Brand + socials */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link to="/" className="flex items-center mb-3">
              <img src={settings.logoUrl || Logo} alt={brandName} className="w-12 h-12 rounded-lg object-cover" />
              <span className="text-white font-bold text-base">{brandName}</span>
            </Link>

            <p
              className="text-xs leading-relaxed mb-5"
              style={{ color: "var(--color-text-muted)" }}
            >
              Inventory management made simple, powerful, and smart.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-2">
              {SOCIALS.map(({ icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    background: "var(--color-surface-3)",
                    color: "var(--color-text-muted)",
                    border: "1px solid var(--color-border-soft)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-text-primary)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-border-brand)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-text-muted)";
                    (e.currentTarget as HTMLElement).style.borderColor =
                      "var(--color-border-soft)";
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <FooterCol title="Product" links={PRODUCT_LINKS} />
          <FooterCol title="Solutions" links={SOLUTIONS_LINKS} />
          <FooterCol title="Resources" links={RESOURCES_LINKS} />
          <FooterCol title="Company" links={COMPANY_LINKS} />

          {/* Newsletter */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: "var(--color-text-faint)" }}
            >
              Newsletter
            </p>
            <p
              className="text-xs leading-relaxed mb-4"
              style={{ color: "var(--color-text-muted)" }}
            >
              Stay updated with the latest news and product updates.
            </p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-xs outline-none transition-all"
                style={{
                  background: "var(--color-input-bg)",
                  border: "1px solid var(--color-input-border)",
                  color: "var(--color-input-text)",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--color-input-border-focus)";
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--color-input-border)";
                }}
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all"
                style={{
                  background: "var(--color-brand-primary)",
                  color: "white",
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
                →
              </button>
            </form>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid var(--color-border-subtle)" }}
        >
          <p className="text-xs" style={{ color: "var(--color-text-faint)" }}>
            &copy; {new Date().getFullYear()} ProInventory. All rights reserved. Built by{" "}
            <a
              href="https://github.com/rajiss-ctrl"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors font-semibold"
              style={{ color: "var(--color-brand-primary-soft)" }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.color = "var(--color-text-primary)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.color =
                  "var(--color-brand-primary-soft)")
              }
            >
              RajisSaraF.Dev
            </a>
          </p>
          <div className="flex items-center gap-5 flex-wrap justify-center">
            {LEGAL_LINKS.map((item) => (
              <a
                key={item}
                href="#"
                className="text-xs transition-colors"
                style={{ color: "var(--color-text-faint)" }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--color-text-muted)")
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color =
                    "var(--color-text-faint)")
                }
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
