import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import {
  canReadGlobally as roleCanReadGlobally,
  canViewResource as roleCanViewResource,
  canWrite as roleCanWrite,
  canWriteResource as roleCanWriteResource,
  getReadScope as roleGetReadScope,
  getWriteScope as roleGetWriteScope,
  isAdminCabang as roleIsAdminCabang,
  isBranchScoped as roleIsBranchScoped,
  isGlobalReadonly as roleIsGlobalReadonly,
  isKetuaYayasan as roleIsKetuaYayasan,
  isPenerusIlmu as roleIsPenerusIlmu,
  isReadOnlyRole as roleIsReadOnly,
  isSuperAdmin as roleIsSuperAdmin,
  isViewerRole,
} from "@/lib/permissions";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("rj_token");
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch((err) => {
        console.warn("Autentikasi gagal:", err);

        localStorage.removeItem("rj_token");
        setUser(false);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("rj_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("rj_token");
    setUser(false);
  };

  const role = user && user.role;
  const isReadOnly = Boolean(roleIsReadOnly(role));
  // Backward-compatible alias: existing components use isViewer as read-only.
  const isViewer = isReadOnly;
  const isSuper = roleIsSuperAdmin(role);
  const isAdminCabang = roleIsAdminCabang(role);
  const isViewerRoleOnly = isViewerRole(role);
  const isPenerusIlmu = roleIsPenerusIlmu(role);
  const isKetuaYayasan = roleIsKetuaYayasan(role);
  const isGlobalReadonly = roleIsGlobalReadonly(role);
  const isBranchScoped = roleIsBranchScoped(role);
  const canViewResource = (resource) => roleCanViewResource(role, resource);
  const canReadGlobally = (resource) => roleCanReadGlobally(role, resource);
  const canWrite = (resource) => roleCanWrite(role, resource);
  const canWriteResource = (resource) => roleCanWriteResource(role, resource);
  const getReadScope = (resource) => roleGetReadScope(role, resource);
  const getWriteScope = (resource) => roleGetWriteScope(role, resource);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        ready,
        login,
        logout,
        isReadOnly,
        isViewer,
        isSuper,
        isAdminCabang,
        isViewerRole: isViewerRoleOnly,
        isPenerusIlmu,
        isKetuaYayasan,
        isGlobalReadonly,
        isBranchScoped,
        canViewResource,
        canReadGlobally,
        canWrite,
        canWriteResource,
        getReadScope,
        getWriteScope,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
