import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, LogIn } from "lucide-react";

const LINKS = [
  { to: "/", label: "Beranda" },
  { to: "/profil", label: "Profil Yayasan" },
  { to: "/pendiri", label: "Profil Majelis" },
  { to: "/cabang", label: "Cabang & Peta" },
  { to: "/galeri", label: "Galeri" },
  { to: "/kontak", label: "Kontak" },
];

export default function PublicNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header className={`sticky top-0 z-50 transition-colors duration-300 ${scrolled ? "glass-nav" : "bg-white/95 border-b border-transparent"}`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 min-w-0" data-testid="nav-logo">
          <div className="flex items-center gap-1.5 shrink-0">
            <img src="/logo-majelis.png" alt="Logo Majelis Raudhatul Jannah" className="h-11 w-11 object-contain" />
            <img src="/logo-yayasan.png" alt="Logo Yayasan Nurul Islam" className="h-11 w-11 object-contain" />
          </div>
          <div className="leading-tight min-w-0 hidden sm:block">
            <p className="font-display font-bold text-charcoal text-[13px] lg:text-sm truncate">
              Yayasan Raudhatul Jannah Nurul Islam wa Iman
            </p>
            <p className="text-[10px] lg:text-[11px] text-primary/80 font-medium truncate">
              Majelis Dzikir &amp; Sholawat Ma'rifatullah wa Ma'rifaturrosul
            </p>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-1 shrink-0">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? "text-primary bg-primary/8" : "text-charcoal/75 hover:text-primary hover:bg-primary/5"
                }`}
              data-testid={`nav-link-${l.to === "/" ? "home" : l.to.slice(1)}`}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden lg:block shrink-0">
          <Link to="/admin/login">
            <Button className="rounded-xl gap-2" data-testid="nav-login-btn">
              <LogIn className="h-4 w-4" /> Login Admin
            </Button>
          </Link>
        </div>

        <button className="lg:hidden p-2 -mr-2 shrink-0" onClick={() => setOpen(!open)} data-testid="mobile-nav-toggle">
          {open ? <X className="h-6 w-6 text-charcoal" /> : <Menu className="h-6 w-6 text-charcoal" />}
        </button>
      </nav>

      {open && (
        <div className="lg:hidden glass-nav border-t border-primary/10 px-4 py-4 space-y-1 animate-fade-up">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `block px-4 py-3 rounded-xl text-sm font-medium ${isActive ? "bg-primary text-white" : "text-charcoal hover:bg-primary/5"}`}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/admin/login" className="block pt-2">
            <Button className="w-full rounded-xl gap-2"><LogIn className="h-4 w-4" /> Login Admin</Button>
          </Link>
        </div>
      )}
    </header>
  );
}
