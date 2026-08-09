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
  MessageSquare,
} from "lucide-react";

export const NAV = [
  {
    section: "Utama",
    items: [
      { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, resource: "dashboard" },
    ],
  },
  {
    section: "Master Data",
    items: [
      { to: "/admin/cabang", label: "Data Cabang", icon: Building2, resource: "cabang" },
      { to: "/admin/guru", label: "Data Guru", icon: GraduationCap, resource: "guru" },
      { to: "/admin/jamaah", label: "Data Jamaah", icon: Users, resource: "jamaah" },
      { to: "/admin/pengurus", label: "Data Pengurus", icon: UserCog, resource: "pengurus" },
      { to: "/admin/users", label: "Manajemen User", icon: ShieldCheck, resource: "users" },
    ],
  },
  {
    section: "Kegiatan",
    items: [
      { to: "/admin/agenda", label: "Agenda Majelis", icon: CalendarDays, resource: "agenda" },
      { to: "/admin/galeri", label: "Galeri", icon: Images, resource: "galeri" },
      { to: "/admin/pesan", label: "Pesan Masuk", icon: MessageSquare, resource: "messages" },
    ],
  },
  {
    section: "Laporan & Sistem",
    items: [
      { to: "/admin/laporan", label: "Laporan & Export", icon: FileBarChart, resource: "export" },
      { to: "/admin/audit", label: "Audit Log", icon: ScrollText, resource: "audit_logs" },
      { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, resource: "settings" },
      { to: "/admin/profil", label: "Profil Admin", icon: User, resource: "profile" },
    ],
  },
];

export const filterVisibleNavigation = (groups, canView) =>
  groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canView(item.resource)),
    }))
    .filter((group) => group.items.length > 0);
