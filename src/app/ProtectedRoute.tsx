import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../services/firebase";
import LoadingSpinner from "../components/ui/LoadingSpinner";

/**
 * ProtectedRoute — blocks unauthenticated users.
 * Waits for Firebase to resolve auth state before redirecting.
 */
const ProtectedRoute = () => {
  const currentUser = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser !== undefined) setLoading(false);
  }, [currentUser]);

  if (loading) return <LoadingSpinner />;
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;