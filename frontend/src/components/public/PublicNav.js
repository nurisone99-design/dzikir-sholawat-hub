import React, { useState, useEffect } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Menu, X, LogIn } from "lucide-react";

const LINKS = [
  { to: "/", label: "Beranda" },
  { to: "/profil", label: "Profil Yayasan" },
  { to: "/pendiri", label: "Pendiri & Penerus" },
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
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="nav-logo">
          <div className="h-10 w-10 rounded-xl bg-emerald-brand flex items-center justify-center">
            <Moon className="h-5 w-5 text-gold" />
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-charcoal text-sm sm:text-base">Raudhatul Jannah</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Nurul Islam wa Iman</p>
          </div>
        </Link>

        <div className="hidden lg:flex items-center gap-1">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to}
              className={({ isActive }) =>
                `px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? "text-primary bg-primary/8" : "text-charcoal/75 hover:text-primary hover:bg-primary/5"
                }`}
              data-testid={`nav-link-${l.to === "/" ? "home" : l.to.slice(1)}`}>
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden lg:block">
          <Link to="/admin/login">
            <Button className="rounded-xl gap-2" data-testid="nav-login-btn">
              <LogIn className="h-4 w-4" /> Login Admin
            </Button>
          </Link>
        </div>

        <button className="lg:hidden p-2 -mr-2" onClick={() => setOpen(!open)} data-testid="mobile-nav-toggle">
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
