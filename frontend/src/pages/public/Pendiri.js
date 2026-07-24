import React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Quote, Crown, Sparkles } from "lucide-react";

const FIGURES = [
  {
    role: "Pendiri Majelis",
    nama: "Syekh KH. Muhammad Saman Al Banjari",
    gelar: "Pengamanah Mutlak Ilmu Ma'rifatullah wa Ma'rifaturrosul",
    img: "https://images.unsplash.com/photo-1585036156171-384164a8c675?w=700&q=85",
    bio: "Beliau adalah pendiri majelis dan pengamanah mutlak sanad keilmuan ma'rifatullah wa ma'rifaturrosul. Dari beliaulah cahaya keilmuan majelis bersumber, diwariskan dengan penuh keberkahan kepada para murid dan penerusnya.",
    pesan: "Jadikanlah dzikir sebagai penghidup hati, dan sholawat sebagai jalan cinta kepada Rasulullah SAW.",
    icon: Crown,
  },
  {
    role: "Penerus Majelis",
    nama: "Kiyai Jumeri Dahri, SH., M.Si.",
    gelar: "Penerus Ilmu Ma'rifatullah wa Ma'rifaturrosul",
    img: "https://images.unsplash.com/photo-1627091908405-30bd51eec537?w=700&q=85",
    bio: "Sebagai penerus ilmu ma'rifatullah wa ma'rifaturrosul, beliau melanjutkan estafet dakwah dan pembinaan jamaah. Dengan keteladanan dan kelembutan, beliau membimbing majelis menuju kemaslahatan umat di berbagai cabang.",
    pesan: "Istiqomah dalam kebaikan adalah kunci keberkahan. Rawatlah ukhuwah, jagalah amaliah.",
    icon: Sparkles,
  },
];

export default function Pendiri() {
  return (
    <div>
      <section className="islamic-pattern relative">
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-5 rounded-full px-4 py-1.5">Masyaikh</Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Pendiri & Penerus Majelis</h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Dengan penuh takzim, kami menghaturkan penghormatan kepada masyaikh pengamanah ilmu majelis.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 space-y-16">
        {FIGURES.map((f, i) => (
          <motion.div key={f.nama} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            className={`grid lg:grid-cols-5 gap-10 items-center ${i % 2 === 1 ? "lg:[direction:rtl]" : ""}`}
            data-testid="figure-card">
            <div className="lg:col-span-2 [direction:ltr]">
              <div className="relative">
                <div className="rounded-[24px] overflow-hidden border-4 border-gold/40 shadow-xl">
                  <img src={f.img} alt={f.nama} className="w-full h-[420px] object-cover" />
                </div>
                <div className="absolute -top-4 -left-4 h-14 w-14 rounded-2xl bg-gold flex items-center justify-center shadow-lg">
                  <f.icon className="h-6 w-6 text-emerald-900" />
                </div>
              </div>
            </div>
            <div className="lg:col-span-3 [direction:ltr]">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/10 rounded-full mb-4">{f.role}</Badge>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-charcoal leading-tight">{f.nama}</h2>
              <p className="text-gold font-medium mt-2">{f.gelar}</p>
              <div className="gold-divider my-6" />
              <p className="text-muted-foreground leading-relaxed">{f.bio}</p>
              <div className="mt-6 premium-card p-6 bg-secondary/40 border-l-4 border-l-gold">
                <Quote className="h-6 w-6 text-gold mb-2" />
                <p className="font-display text-lg text-charcoal italic leading-relaxed">"{f.pesan}"</p>
              </div>
            </div>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
