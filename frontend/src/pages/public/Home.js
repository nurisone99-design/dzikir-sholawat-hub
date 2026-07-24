import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Users, GraduationCap, CalendarDays, ArrowRight, MapPin,
  Sparkles, BookOpen, Megaphone, Moon, ChevronRight,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const STAT_META = [
  { key: "total_cabang", label: "Total Cabang", icon: Building2 },
  { key: "total_jamaah", label: "Total Jamaah", icon: Users },
  { key: "total_guru", label: "Total Guru", icon: GraduationCap },
  { key: "total_agenda", label: "Agenda Majelis", icon: CalendarDays },
];

export default function Home() {
  const [stats, setStats] = useState({});
  const [announcements, setAnnouncements] = useState([]);
  const [agenda, setAgenda] = useState([]);

  useEffect(() => {
    api.get("/public/stats").then((r) => setStats(r.data)).catch(() => {});
    api.get("/public/pengumuman").then((r) => setAnnouncements(r.data.slice(0, 3))).catch(() => {});
    api.get("/public/agenda").then((r) => setAgenda(r.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 islamic-pattern opacity-100" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/95 via-emerald-800/90 to-emerald-950/95" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-32 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-6 rounded-full px-4 py-1.5">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Majelis Dzikir & Sholawat
            </Badge>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
              Yayasan Raudhatul Jannah <span className="text-gold">Nurul Islam wa Iman</span>
            </h1>
            <p className="mt-6 text-white/80 text-base sm:text-lg leading-relaxed max-w-xl">
              Menaungi kebersamaan spiritual jamaah melalui dzikir, sholawat, dan pembinaan
              ilmu ma'rifatullah wa ma'rifaturrosul di seluruh cabang.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/profil">
                <Button size="lg" className="rounded-xl bg-gold text-emerald-900 hover:bg-gold/90 gap-2 h-12 px-6" data-testid="hero-profil-btn">
                  Profil Yayasan <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/cabang">
                <Button size="lg" variant="outline" className="rounded-xl h-12 px-6 border-white/40 bg-white/5 text-white hover:bg-white/15 hover:text-white gap-2" data-testid="hero-cabang-btn">
                  <MapPin className="h-4 w-4" /> Lokasi Cabang
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7 }} className="relative hidden lg:block">
            <div className="rounded-[24px] overflow-hidden border-4 border-gold/30 shadow-2xl">
              <img src="https://images.unsplash.com/photo-1766166793579-4833898111a5?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
                alt="Interior masjid dengan ornamen emas" className="w-full h-[440px] object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 premium-card px-6 py-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <Moon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-charcoal font-display">{stats.total_cabang || 0}</p>
                <p className="text-xs text-muted-foreground">Cabang Aktif</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 -mt-14 relative z-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAT_META.map((s, i) => (
            <motion.div key={s.key} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
              className="premium-card p-6" data-testid={`stat-${s.key}`}>
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-3xl font-bold text-charcoal font-display">{stats[s.key] ?? 0}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ANNOUNCEMENTS + AGENDA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Megaphone className="h-5 w-5 text-gold" />
            <h2 className="font-display text-3xl font-bold text-charcoal">Pengumuman Terbaru</h2>
          </div>
          <div className="gold-divider mb-8" />
          <div className="space-y-4">
            {announcements.length === 0 && <p className="text-muted-foreground">Belum ada pengumuman.</p>}
            {announcements.map((a, i) => (
              <motion.div key={a.id} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp}
                className="premium-card p-6 flex gap-5 items-start" data-testid="announcement-item">
                <div className="h-12 w-12 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-gold" />
                </div>
                <div>
                  <Badge variant="secondary" className="rounded-full mb-2 text-xs">{a.kategori}</Badge>
                  <h3 className="font-semibold text-charcoal text-lg">{a.judul}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{a.isi}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-bold text-charcoal">Agenda</h2>
          </div>
          <div className="gold-divider mb-8" />
          <div className="space-y-4">
            {agenda.length === 0 && <p className="text-muted-foreground">Belum ada agenda.</p>}
            {agenda.map((a) => (
              <div key={a.id} className="premium-card p-5" data-testid="agenda-item">
                <p className="text-xs font-semibold text-primary">
                  {new Date(a.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} • {a.waktu}
                </p>
                <h3 className="font-semibold text-charcoal mt-1">{a.judul}</h3>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {a.lokasi}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUICK LINKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { to: "/pendiri", title: "Pendiri & Penerus", desc: "Mengenal masyaikh pengamanah ilmu majelis.", icon: Sparkles },
            { to: "/cabang", title: "Cabang & Peta", desc: "Temukan cabang majelis terdekat dari Anda.", icon: MapPin },
            { to: "/galeri", title: "Galeri Kegiatan", desc: "Dokumentasi kegiatan dzikir & sholawat.", icon: Building2 },
          ].map((q) => (
            <Link key={q.to} to={q.to} className="premium-card p-8 group hover:-translate-y-1 transition-transform" data-testid={`quicklink-${q.to.slice(1)}`}>
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <q.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-charcoal">{q.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{q.desc}</p>
              <span className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-4 group-hover:gap-2 transition-all">
                Selengkapnya <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
