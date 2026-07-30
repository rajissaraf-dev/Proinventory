import { Link } from "react-router-dom";
import { MdBarChart, MdInventory2, MdShield, MdHeadsetMic } from "react-icons/md";
import Logo from "../../assets/img/stocktrack-logo.png";
import AuthBottomImg from "../../assets/img/auth-bottom-Photoroom.png";

const FEATURES = [
  {
    icon: <MdBarChart size={18} />,
    iconBg: "var(--color-nav-active-bg)",
    iconColor: "var(--color-brand-primary-soft)",
    title: "Real-time Insights",
    desc: "Get live updates on stock, orders, and performance.",
  },
  {
    icon: <MdInventory2 size={18} />,
    iconBg: "var(--color-stock-in-soft)",
    iconColor: "var(--color-stock-in)",
    title: "Smart Management",
    desc: "Automate inventory tracking and reduce manual work.",
  },
  {
    icon: <MdShield size={18} />,
    iconBg: "var(--color-info-soft)",
    iconColor: "var(--color-info)",
    title: "Secure & Reliable",
    desc: "Enterprise-grade security to keep your data safe.",
  },
  {
    icon: <MdHeadsetMic size={18} />,
    iconBg: "var(--color-warning-soft)",
    iconColor: "var(--color-warning)",
    title: "Always Here to Help",
    desc: "24/7 support from our dedicated team whenever you need it.",
  },
];


const AuthLeftPanel = () => (
  <div
    className="hidden lg:flex flex-col h-full px-10 pt-8 pb-0 relative overflow-hidden"
    style={{ background: "var(--color-bg-sidebar)" }}
  >
    {/* Background glow */}
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Top-right purple glow */}
      <div
        className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-10"
        style={{ background: "var(--color-brand-secondary)" }}
      />
      {/* Bottom-left deep blue/indigo glow — sits behind the illustration */}
      <div
        className="absolute -bottom-16 -left-16 w-[340px] h-[340px] rounded-full blur-[90px] opacity-35"
        style={{ background: "#1a0a4a" }}
      />
      <div
        className="absolute -bottom-8 left-0 w-[280px] h-[280px] rounded-full blur-[70px] opacity-40"
        style={{ background: "var(--color-brand-primary)" }}
      />
      <div
        className="absolute bottom-0 left-1/4 w-[200px] h-[200px] rounded-full blur-[80px] opacity-25"
        style={{ background: "var(--color-brand-cyan)" }}
      />
    </div>

    {/* Logo */}
    <div className="relative z-10 pb-52">{/* pb-52 keeps content above the bottom illustration */}
      <Link to="/" className="flex items-center mb-4">
        <img src={Logo} alt="ProInventory" className="w-14 h-w-14 rounded-lg" />
        <span className="text-white font-bold text-lg">
          Pro<span style={{ color: "var(--color-brand-primary-soft)" }}>Inventory</span>
        </span>
      </Link>

      

      {/* Feature list */}
      <ul className="space-y-2">
        {FEATURES.map(({ icon, iconBg, iconColor, title, desc }) => (
          <li key={title} className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: iconBg }}
            >
              <span style={{ color: iconColor }}>{icon}</span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                {title}
              </p>
              <p className="text-xs leading-snug mt-0.5" style={{ color: "var(--color-text-muted)" }}>
                {desc}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    {/* 3D inventory illustration — bottom of panel, flush left, slight overflow */}
    <div
      className="absolute -bottom-2 left-0 right-0 pointer-events-none select-none z-10 pt-14"
      aria-hidden
    >
      <img
        src={AuthBottomImg}
        alt=""
        className="w-full block"
        style={{
          /* The photoroom-cut image has transparent BG — let the glow show through */
          filter: "drop-shadow(0 -8px 40px rgba(79,70,229,0.45)) drop-shadow(0 0 60px rgba(0,229,255,0.15))",
          /* Align bottom, bleed slightly past the panel edge for depth */
          marginBottom: "-6rem",
          objectFit: "contain",
          objectPosition: "bottom center",
        }}
      />
    </div>
  </div>
);

export default AuthLeftPanel;
