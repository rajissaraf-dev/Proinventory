import { lazy, Suspense } from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import RootLayout        from "../components/layout/RootLayout";
import ProtectedRoute    from "./ProtectedRoute";
import RoleRoute         from "./RoleRoute";
import LoadingSpinner    from "../components/ui/LoadingSpinner";

/* ── Public pages ── */
const LoginPage         = lazy(() => import("../pages/LoginPage"));
const ResetPasswordPage = lazy(() => import("../pages/ResetPasswordPage"));
const NotFoundPage      = lazy(() => import("../pages/NotFoundPage"));

/* ── Authenticated pages ── */
const OwnerDashboardPage  = lazy(() => import("../pages/OwnerDashboardPage"));
const ProductsPage        = lazy(() => import("../pages/ProductsPage"));

const AppRouter = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route element={<RootLayout />}>

        {/* ── Public Routes ── */}
        {/* Redirect root to login */}
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="reset" element={<ResetPasswordPage />} />

        {/* ── Authenticated Routes ── */}
        <Route element={<ProtectedRoute />}>

          {/* 
            ── Owner Dashboard ──
            company_owner = super admin (full access to everything)
            company_admin = full access except destructive actions
          */}
          <Route 
            element={
              <RoleRoute 
                allow={["company_owner", "company_admin"]} 
                redirectTo="/dashboard" 
              />
            }
          >
            <Route path="owner" element={<OwnerDashboardPage />} />
          </Route>

          {/* 
            ── Dashboard ──
            All authenticated users including staff can access
            Role-aware rendering happens inside OwnerDashboardPage
          */}
          <Route path="dashboard" element={<OwnerDashboardPage />} />

          {/* 
            ── Products Page ──
            All authenticated users can view and sell products
            Only owner and admin can edit/delete
          */}
          <Route path="products" element={<ProductsPage />} />

          {/* 
            ── Redirect /superadmin to /owner ──
            Since owner is the super admin now
          */}
          <Route path="superadmin" element={<Navigate to="/owner" replace />} />

        </Route>

        {/* ── 404 ── */}
        <Route path="*" element={<NotFoundPage />} />

      </Route>
    </Routes>
  </Suspense>
);

export default AppRouter;