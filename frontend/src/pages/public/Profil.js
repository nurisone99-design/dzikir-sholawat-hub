import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Eye, Target, History, Users, Heart, BookOpen, HandHeart, Sparkles } from "lucide-react";

const VALUES = [
  { icon: Heart, title: "Keikhlasan", desc: "Setiap amal dilandasi niat ikhlas semata mencari ridha Allah SWT." },
  { icon: BookOpen, title: "Keilmuan", desc: "Menjaga sanad keilmuan ma'rifatullah wa ma'rifaturrosul yang lurus." },
  { icon: HandHeart, title: "Ukhuwah", desc: "Mempererat persaudaraan sesama jamaah dalam bingkai kasih sayang." },
  { icon: Sparkles, title: "Istiqomah", desc: "Menjaga keajegan dzikir dan sholawat dalam kehidupan sehari-hari." },
];

const PENGURUS = [
  { jabatan: "Pembina Yayasan", nama: "Kiyai Jumeri Dahri, SH., M.Si." },
  { jabatan: "Ketua Umum", nama: "H. Abdul Karim" },
  { jabatan: "Sekretaris Umum", nama: "Ustadz Ahmad Fauzi" },
  { jabatan: "Bendahara Umum", nama: "Hj. Siti Aminah" },
  { jabatan: "Koordinator Dakwah", nama: "Ustadz Muhammad Ridwan" },
  { jabatan: "Koordinator Cabang", nama: "H. Sulaiman Rais" },
];

export default function Profil() {
  return (
    <div>
      <section className="islamic-pattern relative">
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-5 rounded-full px-4 py-1.5">Tentang Kami</Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Profil Singkat Yayasan</h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Yayasan Raudhatul Jannah Nurul Islam wa Iman menaungi Majelis Dzikir dan Sholawat
            sebagai wadah pembinaan ruhani dan pengamalan ilmu ma'rifat bagi seluruh jamaah.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="premium-card p-8" data-testid="visi-card">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
            <Eye className="h-5 w-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold text-charcoal mb-3">Visi</h2>
          <p className="text-muted-foreground leading-relaxed">
            Menjadi majelis yang istiqomah membina insan bertaqwa, berakhlak mulia, dan
            ma'rifat kepada Allah SWT serta Rasulullah SAW melalui dzikir dan sholawat.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.1 }} className="premium-card p-8" data-testid="misi-card">
          <div className="h-12 w-12 rounded-xl bg-gold/15 flex items-center justify-center mb-5">
            <Target className="h-5 w-5 text-gold" />
          </div>
          <h2 className="font-display text-2xl font-bold text-charcoal mb-3">Misi</h2>
          <ul className="text-muted-foreground leading-relaxed space-y-2 list-disc pl-5">
            <li>Menyelenggarakan majelis dzikir dan sholawat secara rutin.</li>
            <li>Membina jamaah melalui pengajaran kitab dan amaliah.</li>
            <li>Menyebarkan nilai spiritual di berbagai cabang.</li>
            <li>Menguatkan ukhuwah islamiyah antar jamaah.</li>
          </ul>
        </motion.div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="premium-card p-8 md:p-12">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="font-display text-3xl font-bold text-charcoal">Sejarah Singkat</h2>
          </div>
          <div className="gold-divider mb-6" />
          <p className="text-muted-foreground leading-relaxed">
            Majelis Dzikir dan Sholawat Raudhatul Jannah Nurul Islam wa Iman didirikan atas
            dasar kecintaan kepada Allah SWT dan Rasulullah SAW. Berawal dari pengajian kecil,
            majelis ini tumbuh menjadi wadah spiritual yang menaungi ribuan jamaah di berbagai kota.
            Sanad keilmuan diwariskan dari <span className="text-primary font-medium">Syekh KH. Muhammad Saman Al Banjari </span>
            selaku pendiri, dan diteruskan oleh <span className="text-primary font-medium">Kiyai Jumeri Dahri, SH., M.Si.</span>
            sebagai penerus ilmu ma'rifatullah wa ma'rifaturrosul.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl font-bold text-charcoal">Nilai-Nilai Spiritual</h2>
          <div className="gold-divider mx-auto mt-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUES.map((v, i) => (
            <motion.div key={v.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="premium-card p-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <v.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-charcoal">{v.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{v.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-24">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-gold" />
            <h2 className="font-display text-3xl font-bold text-charcoal">Struktur Kepengurusan</h2>
          </div>
          <div className="gold-divider mx-auto mt-4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PENGURUS.map((p, i) => (
            <div key={i} className="premium-card p-6 flex items-center gap-4" data-testid="struktur-item">
              <div className="h-12 w-12 rounded-full bg-gold/15 flex items-center justify-center text-gold font-display font-bold text-lg shrink-0">
                {p.nama.split(" ")[0][0]}
              </div>
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">{p.jabatan}</p>
                <p className="font-semibold text-charcoal">{p.nama}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
