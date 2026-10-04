import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-ink-muted">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const activeRole = user.activeMembership?.role || user.role;
  if (roles && !roles.includes(activeRole)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
