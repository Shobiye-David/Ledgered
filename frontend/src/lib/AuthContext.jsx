import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("certchain_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("certchain_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("certchain_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  const googleLogin = useCallback(async (credential) => {
    const res = await api.post("/auth/google", { credential });
    if (res.data.needsSelection) return res.data;
    localStorage.setItem("certchain_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const selectMembership = useCallback(async (selectionToken, institutionId, role) => {
    const res = await api.post("/auth/google", { selectionToken, institutionId, role });
    localStorage.setItem("certchain_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  async function adminLogin(password) {
    const accessPath = import.meta.env.VITE_ADMIN_ACCESS_PATH;
    const res = await api.post(`/auth/${accessPath}`, { password });
    localStorage.setItem("certchain_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem("certchain_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, selectMembership, adminLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
