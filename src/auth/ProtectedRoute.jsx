import { Navigate, useLocation } from "react-router-dom";
import { requiredAccess } from "./access";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { isReady, isAuthenticated, accessReady, can } = useAuth();
  const location = useLocation();
  const access = requiredAccess(location.pathname);

  if (!isReady || (isAuthenticated && !accessReady)) {
    return <div className="auth-loading">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (access && !can(access.resource, access.action)) {
    return (
      <div className="auth-loading">
        Your role does not include access to this page.
      </div>
    );
  }

  return children;
}
