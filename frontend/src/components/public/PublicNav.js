import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LogIn } from "lucide-react";

const LINKS = [
  { name: "Beranda", href: "/" },
  { name: "Profil Yayasan", href: "/profil-yayasan" },
  { name: "Profil Majelis", href: "/profil-majelis" },
  { name: "Cabang & Peta", href: "/cabang" },
  { name: "Galeri", href: "/galeri" },
  { name: "Kontak", href: "/kontak" },
];

export default function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Otomatis tutup menu mobile saat pengguna berpindah halaman
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 transition-colors bg-white shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
        {/* LOGO (Kiri) */}
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0"
          data-testid="nav-logo"
        >
          <div className="flex items-center gap-1.5 shrink-0">
            <img
              src="/logo-majelis.png"
              alt="Logo Majelis Raudhatul Jannah"
              className="h-11 w-11 object-contain"
            />
            <img
              src="/logo-yayasan.png"
              alt="Logo Yayasan Nurul Islam"
              className="h-11 w-11 object-contain"
            />
          </div>
          <div className="leading-tight min-w-0 block">
            <p className="font-display font-bold text-charcoal text-[13px] lg:text-sm">
              Yayasan Raudhatul Jannah Nurul Islam wa Iman
            </p>
            <p className="text-[10px] lg:text-[11px] text-primary/80 font-medium whitespace-nowrap">
              Majelis Dzikir & Sholawat Ma'rifatullah wa Ma'rifaturrosul
            </p>
          </div>
        </Link>

        {/* MENU DESKTOP (Tampil di layar besar / lg) */}
        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {LINKS.map((l) => (
            <NavLink
              key={l.href}
              to={l.href}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-charcoal-light hover:text-primary hover:bg-cream-dark/50"
                }`
              }
            >
              {l.name}
            </NavLink>
          ))}

          {/* Tombol Login Admin versi Desktop */}
          <Link
            to="/admin/login"
            className="ml-2 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition-all shadow-md whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>Login Admin</span>
          </Link>
        </div>

        {/* TOMBOL GARIS TIGA / HAMBURGER (Hanya tampil di Mobile / < lg) */}
        <button
          onClick={() => setOpen(!open)}
          className="lg:hidden p-2 rounded-lg text-charcoal hover:bg-gray-100 focus:outline-none"
          aria-label="Toggle Menu"
        >
          {open ? (
            /* Ikon X saat menu terbuka */
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            /* Ikon Garis Tiga saat menu tertutup */
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </nav>

      {/* DROPDOWN MENU MOBILE (Hanya muncul saat tombol garis tiga diklik) */}
      {open && (
        <div className="lg:hidden bg-white border-t border-gray-100 px-4 pt-2 pb-6 space-y-2 shadow-lg">
          {LINKS.map((l) => (
            <NavLink
              key={l.href}
              to={l.href}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-base font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-charcoal-light hover:text-primary hover:bg-cream-dark/50"
                }`
              }
            >
              {l.name}
            </NavLink>
          ))}

          {/* Tombol Login Admin versi Mobile */}
          <Link
            to="/admin/login"
            className="flex items-center justify-center gap-2 w-full mt-4 px-5 py-2.5 bg-primary text-white rounded-xl text-base font-semibold hover:bg-primary-dark transition-all shadow-md"
          >
            <LogIn className="w-5 h-5" />
            <span>Login Admin</span>
          </Link>
        </div>
      )}
    </header>
  );
}
