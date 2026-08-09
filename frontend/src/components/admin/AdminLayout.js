import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Users,
  UserCog,
  ShieldCheck,
  CalendarDays,
  Images,
  FileBarChart,
  ScrollText,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Moon,
  MessageSquare,
} from "lucide-react";

const NAV = [
  {
    section: "Utama",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    section: "Master Data",
    items: [
      { to: "/admin/cabang", label: "Data Cabang", icon: Building2 },
      { to: "/admin/guru", label: "Data Guru", icon: GraduationCap },
      { to: "/admin/jamaah", label: "Data Jamaah", icon: Users },
      { to: "/admin/pengurus", label: "Data Pengurus", icon: UserCog },
      {
        to: "/admin/users",
        label: "Manajemen User",
        icon: ShieldCheck,
        super: true,
      },
    ],
  },
  {
    section: "Kegiatan",
    items: [
      { to: "/admin/agenda", label: "Agenda Majelis", icon: CalendarDays },
      { to: "/admin/galeri", label: "Galeri", icon: Images },
      {
        to: "/admin/pesan",
        label: "Pesan Masuk",
        icon: MessageSquare,
        super: true,
      },
    ],
  },
  {
    section: "Laporan & Sistem",
    items: [
      { to: "/admin/laporan", label: "Laporan & Export", icon: FileBarChart },
      {
        to: "/admin/audit",
        label: "Audit Log",
        icon: ScrollText,
        super: true,
      },
      {
        to: "/admin/pengaturan",
        label: "Pengaturan",
        icon: Settings,
        super: true,
      },
      { to: "/admin/profil", label: "Profil Admin", icon: User },
    ],
  },
];

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin_cabang: "Admin Cabang",
  viewer: "Viewer",
  penerus_ilmu: "Penerus Ilmu",
  ketua_yayasan: "Ketua Yayasan",
};

export default function AdminLayout() {
  const { user, logout, isSuper } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex flex-col items-center text-center gap-2.5">
          {/* Logo Majelis di Atas */}
          <img
            src="/logo-majelis.png"
            alt="Logo Majelis"
            className="h-12 w-12 object-contain shrink-0"
          />

          {/* Teks Rata Tengah */}
          <div className="w-full">
            <p className="text-white font-bold leading-snug text-xs">
              Majelis Dzikir & Sholawat Ma'rifatullah wa Ma'rifaturrosul
            </p>
            <p className="text-white/70 text-[10px] font-medium mt-1">
              Raudhatul jannah Nurul Islam wa Iman
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
        {NAV.map((grp) => (
          <div key={grp.section}>
            <p className="px-3 mb-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold">
              {grp.section}
            </p>
            <div className="space-y-0.5">
              {grp.items
                .filter((i) => !i.super || isSuper)
                .map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    data-testid={`nav-${item.to.split("/").pop()}`}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-gold text-emerald-900"
                          : "text-white/75 hover:bg-white/10 hover:text-white"
                      }`
                    }
                  >
                    <item.icon className="h-[18px] w-[18px]" /> {item.label}
                  </NavLink>
                ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-gold text-emerald-900 text-sm font-semibold">
              {(user?.name || user?.username || "A").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">
              {user?.name || user?.username}
            </p>
            <Badge className="bg-white/10 text-white/80 hover:bg-white/10 text-[10px] px-1.5 py-0 h-4">
              {ROLE_LABEL[user?.role]}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col islamic-pattern z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-64 islamic-pattern animate-fade-up">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 glass-nav h-16 flex items-center justify-between px-4 sm:px-6">
          <button
            className="lg:hidden p-2 -ml-2"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu-btn"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary font-medium hover:underline"
            >
              Lihat Situs Publik
            </a>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2"
                  data-testid="logout-btn"
                >
                  <LogOut className="h-4 w-4" /> Keluar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Keluar dari portal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sesi Anda akan diakhiri dengan aman.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">
                    Batal
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleLogout}
                    className="rounded-xl"
                    data-testid="confirm-logout"
                  >
                    Keluar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
