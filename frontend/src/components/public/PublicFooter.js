import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import {
  Moon,
  Instagram,
  Facebook,
  Youtube,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

export default function PublicFooter() {
  const [s, setS] = useState({});
  useEffect(() => {
    api
      .get("/public/settings")
      .then((r) => setS(r.data || {}))
      .catch((err) => {
        console.error("Gagal memuat pengaturan footer:", err);
      });
  }, []);

  return (
    <footer className="islamic-pattern text-white mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-white/95 rounded-xl px-2.5 py-2">
              <img
                src="/logo-majelis.png"
                alt="Logo Majelis"
                className="h-10 w-10 object-contain"
              />
              <img
                src="/logo-yayasan.png"
                alt="Logo Yayasan"
                className="h-10 w-10 object-contain"
              />
            </div>
            <div>
              <p className="font-display font-bold text-base leading-tight">
                Yayasan Raudhatul Jannah
              </p>
              <p className="text-white/60 text-xs">Nurul Islam wa Iman</p>
            </div>
          </div>
          <p className="text-white/70 text-sm leading-relaxed max-w-md">
            {s.nama || "Yayasan Raudhatul Jannah Nurul Islam wa Iman"} — Majelis
            Dzikir &amp; Sholawat Ma'rifatullah wa Ma'rifaturrosul yang menaungi
            kebersamaan spiritual jamaah dalam menuju ridha Allah SWT.
          </p>
          <div className="flex gap-3 mt-5">
            {s.youtube && (
              <a
                href={s.youtube}
                target="_blank"
                rel="noreferrer"
                className="h-9 w-9 rounded-lg bg-white/10 hover:bg-gold hover:text-emerald-900 flex items-center justify-center transition-colors"
              >
                <Youtube className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-gold">Navigasi</h4>
          <ul className="space-y-2.5 text-sm text-white/70">
            <li>
              <Link to="/profil" className="hover:text-white">
                Profil Yayasan
              </Link>
            </li>
            <li>
              <Link to="/pendiri" className="hover:text-white">
                Pendiri & Penerus
              </Link>
            </li>
            <li>
              <Link to="/cabang" className="hover:text-white">
                Cabang & Peta
              </Link>
            </li>
            <li>
              <Link to="/galeri" className="hover:text-white">
                Galeri
              </Link>
            </li>
            <li>
              <Link to="/kontak" className="hover:text-white">
                Kontak
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-gold">Kontak</h4>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex gap-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gold" />{" "}
              {s.alamat || "Jakarta, Indonesia"}
            </li>
            <li className="flex gap-2">
              <Phone className="h-4 w-4 shrink-0 mt-0.5 text-gold" />{" "}
              {s.telepon || "-"}
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 shrink-0 mt-0.5 text-gold" />{" "}
              {s.email || "-"}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-center text-white/50 text-xs">
          © {new Date().getFullYear()}{" "}
          {s.nama || "Yayasan Raudhatul Jannah Nurul Islam wa Iman"}. Seluruh
          hak cipta dilindungi.
        </div>
      </div>
    </footer>
  );
}
