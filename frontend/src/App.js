import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";

import PublicLayout from "@/components/public/PublicLayout";
import Home from "@/pages/public/Home";
import Profil from "@/pages/public/Profil";
import Pendiri from "@/pages/public/Pendiri";
import Cabang from "@/pages/public/Cabang";
import Galeri from "@/pages/public/Galeri";
import Kontak from "@/pages/public/Kontak";

import Login from "@/pages/admin/Login";
import AdminLayout from "@/components/admin/AdminLayout";
import Dashboard from "@/pages/admin/Dashboard";
import DataCabang from "@/pages/admin/DataCabang";
import DataGuru from "@/pages/admin/DataGuru";
import DataJamaah from "@/pages/admin/DataJamaah";
import DataPengurus from "@/pages/admin/DataPengurus";
import UserManagement from "@/pages/admin/UserManagement";
import Agenda from "@/pages/admin/Agenda";
import GaleriAdmin from "@/pages/admin/GaleriAdmin";
import Laporan from "@/pages/admin/Laporan";
import ProfilAdmin from "@/pages/admin/ProfilAdmin";
import AuditLog from "@/pages/admin/AuditLog";
import Pengaturan from "@/pages/admin/Pengaturan";
import Pesan from "@/pages/admin/Pesan";

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
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
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
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
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

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
