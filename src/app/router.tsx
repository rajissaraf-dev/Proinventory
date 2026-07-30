// src/router/router.tsx
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
const MessagesPage        = lazy(() => import("../pages/MessagesPage"));

const AppRouter = () => (
  <Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route element={<RootLayout />}>

        {/* ── Public Routes ── */}
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="reset" element={<ResetPasswordPage />} />

        {/* ── Authenticated Routes ── */}
        <Route element={<ProtectedRoute />}>

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

          <Route path="dashboard" element={<OwnerDashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="messages" element={<MessagesPage />} /> {/* ← ADDED */}

          <Route path="superadmin" element={<Navigate to="/owner" replace />} />

        </Route>

        <Route path="*" element={<NotFoundPage />} />

      </Route>
    </Routes>
  </Suspense>
);

export default AppRouter;