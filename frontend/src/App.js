import { lazy, Suspense, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import PublicLayout from "@/components/public/PublicLayout";
const Home = lazy(() => import("@/pages/public/Home"));
const Profil = lazy(() => import("@/pages/public/Profil"));
const Pendiri = lazy(() => import("@/pages/public/Pendiri"));
const Cabang = lazy(() => import("@/pages/public/Cabang"));
const Galeri = lazy(() => import("@/pages/public/Galeri"));
const Kontak = lazy(() => import("@/pages/public/Kontak"));

const Login = lazy(() => import("@/pages/admin/Login"));
import AdminLayout from "@/components/admin/AdminLayout";
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const DataCabang = lazy(() => import("@/pages/admin/DataCabang"));
const DataGuru = lazy(() => import("@/pages/admin/DataGuru"));
const DataJamaah = lazy(() => import("@/pages/admin/DataJamaah"));
const DataPengurus = lazy(() => import("@/pages/admin/DataPengurus"));
const UserManagement = lazy(() => import("@/pages/admin/UserManagement"));
const Agenda = lazy(() => import("@/pages/admin/Agenda"));
const GaleriAdmin = lazy(() => import("@/pages/admin/GaleriAdmin"));
const Laporan = lazy(() => import("@/pages/admin/Laporan"));
const ProfilAdmin = lazy(() => import("@/pages/admin/ProfilAdmin"));
const AuditLog = lazy(() => import("@/pages/admin/AuditLog"));
const Pengaturan = lazy(() => import("@/pages/admin/Pengaturan"));
const Pesan = lazy(() => import("@/pages/admin/Pesan"));
import NotFound from "@/pages/NotFound";

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth();
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

function App() {
  useEffect(() => {
    document.documentElement.lang = "id";
  }, []);

  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
            }
          >
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/profil" element={<Profil />} />
                <Route path="/pendiri" element={<Pendiri />} />
                <Route path="/cabang" element={<Cabang />} />
                <Route path="/galeri" element={<Galeri />} />
                <Route path="/kontak" element={<Kontak />} />
              </Route>

              <Route path="/admin/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="cabang" element={<DataCabang />} />
                <Route path="guru" element={<DataGuru />} />
                <Route path="jamaah" element={<DataJamaah />} />
                <Route path="pengurus" element={<DataPengurus />} />
                <Route path="users" element={<UserManagement />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="galeri" element={<GaleriAdmin />} />
                <Route path="laporan" element={<Laporan />} />
                <Route path="pesan" element={<Pesan />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="pengaturan" element={<Pengaturan />} />
                <Route path="profil" element={<ProfilAdmin />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
