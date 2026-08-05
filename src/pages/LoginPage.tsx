// src/pages/LoginPage.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useForm, type Resolver } from "react-hook-form";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { MdEmail, MdLock, MdVisibility, MdVisibilityOff } from "react-icons/md";
import { auth } from "../services/firebase";
import { setCurrentUser, clearCurrentUser, fetchUserProfile } from "../features/auth/authSlice";
import AuthLeftPanel from "../components/layout/AuthLeftPanel";
import useAppDispatch from "../hooks/useAppDispatch";

/* ─── Types ─────────────────────────────────────────────── */
interface LoginForm {
  email: string;
  password: string;
}

const schema: yup.ObjectSchema<LoginForm> = yup.object({
  email: yup.string().email("Invalid email").required("Email is required"),
  password: yup.string().min(6, "Min 6 characters").required("Password is required"),
});

const loginResolver: Resolver<LoginForm> = yupResolver(schema) as Resolver<LoginForm>;

const INPUT_BASE =
  "w-full rounded-xl px-4 py-3 pl-11 text-sm outline-none transition-all";

const INPUT_STYLE = {
  background: "var(--color-input-bg)",
  border: "1px solid var(--color-input-border)",
  color: "var(--color-input-text)",
};


/* ─── Page ───────────────────────────────────────────────── */
const LoginPage = () => {
  const navigate  = useNavigate();
  const dispatch  = useAppDispatch();
  const [showPass,   setShowPass]   = useState(false);
  const [remember,   setRemember]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [serverErr,  setServerErr]  = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: loginResolver,
  });

  /* ── Core login helper ── */
  const login = async (email: string, password: string) => {
    // Clear any stale session data before signing in
    dispatch(clearCurrentUser());
    sessionStorage.removeItem("currentUser");
    localStorage.removeItem("currentUser");

    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const payload  = { uid: user.uid, email: user.email ?? "" };
    dispatch(setCurrentUser(payload));
    if (remember) localStorage.setItem("currentUser", JSON.stringify(payload));
    else          sessionStorage.setItem("currentUser", JSON.stringify(payload));

    console.log("✅ [Login] Signed in, fetching user profile for uid:", user.uid);
    const profile = await dispatch(fetchUserProfile(user.uid)).unwrap();
    
    // ─── Only owner and admin roles exist now ───
    const target = (profile.role === "company_owner" || profile.role === "company_admin")
      ? "/owner"
      : "/dashboard";

    navigate(target);
  };

  /* ── Email / password submit ── */
  const onSubmit = async (data: LoginForm) => {
    setLoading(true); setServerErr("");
    try {
      await login(data.email ?? "", data.password ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("No user profile found") || message.includes("profile")) {
        setServerErr("We couldn't load your profile. Please try again or contact support.");
      } else {
        setServerErr("Incorrect email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-bg-app)" }}
    >
      <div
        className="w-full max-w-5xl rounded-2xl overflow-hidden grid lg:grid-cols-2 min-h-150"
        style={{
          background: "var(--color-surface-1)",
          border: "1px solid var(--color-border-soft)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* ── Left panel ── */}
        <AuthLeftPanel />

        {/* ── Right panel ── */}
        <div
          className="flex flex-col justify-between p-8 sm:p-10 overflow-y-auto"
          style={{ background: "var(--color-surface-2)" }}
        >
          <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">

            {/* Heading */}
            <div className="text-center mb-8">
              <h1
                className="text-2xl font-extrabold mb-2"
                style={{ color: "var(--color-text-primary)" }}
              >
                Welcome back
              </h1>
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                Glad to see you again! Please login to your account.
              </p>
            </div>

            {/* Error banner */}
            {serverErr && (
              <div
                className="mb-4 px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "var(--color-danger-soft)",
                  border: "1px solid var(--color-danger-border)",
                  color: "var(--color-danger)",
                }}
              >
                {serverErr}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

              {/* Email */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Email Address
                </label>
                <div className="relative">
                  <MdEmail
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--color-input-icon)" }}
                  />
                  <input
                    {...register("email")}
                    type="email"
                    placeholder="Enter your email address"
                    autoComplete="email"
                    className={INPUT_BASE}
                    style={INPUT_STYLE}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e)  => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  Password
                </label>
                <div className="relative">
                  <MdLock
                    size={16}
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: "var(--color-input-icon)" }}
                  />
                  <input
                    {...register("password")}
                    type={showPass ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className={`${INPUT_BASE} pr-12`}
                    style={INPUT_STYLE}
                    onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border-focus)")}
                    onBlur={(e)  => ((e.currentTarget as HTMLElement).style.borderColor = "var(--color-input-border)")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--color-input-icon)" }}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs" style={{ color: "var(--color-danger)" }}>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded accent-indigo-500"
                  />
                  <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    Remember me
                  </span>
                </label>
                <Link
                  to="/reset"
                  className="text-xs font-medium transition-colors"
                  style={{ color: "var(--color-brand-primary-soft)" }}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Log In button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                style={{
                  background: "var(--color-brand-primary)",
                  color: "white",
                  boxShadow: "var(--shadow-glow)",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-brand-primary-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--color-brand-primary)")}
              >
                {loading ? "Signing in…" : "Log In"}
              </button>

            </form>

          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-8" style={{ color: "var(--color-text-faint)" }}>
            © {new Date().getFullYear()} ProInventory. All rights reserved. Built by{" "}
            <a
              href="https://github.com/rajiss-ctrl"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold transition-colors"
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
        </div>
      </div>
    </div>
  );
};

export default LoginPage;