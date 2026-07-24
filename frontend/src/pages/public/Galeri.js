import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { X, PlayCircle } from "lucide-react";

const CATS = ["Semua", "Dzikir Rutin", "Hari Besar Islam", "Harlah", "Kegiatan Sosial"];

export default function Galeri() {
  const [items, setItems] = useState([]);
  const [cat, setCat] = useState("Semua");
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => { api.get("/public/galeri").then((r) => setItems(r.data)).catch(() => {}); }, []);

  const filtered = cat === "Semua" ? items : items.filter((i) => i.kategori === cat);

  return (
    <div>
      <section className="islamic-pattern relative">
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-5 rounded-full px-4 py-1.5">Dokumentasi</Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">Galeri Kegiatan</h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Momen dzikir, sholawat, dan kebersamaan jamaah dalam berbagai kegiatan majelis.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                cat === c ? "bg-primary text-white border-primary" : "bg-white text-charcoal border-border hover:border-primary"
              }`}
              data-testid={`galeri-filter-${c}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <AnimatePresence>
            {filtered.map((item, i) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }} transition={{ delay: (i % 8) * 0.04 }}
                onClick={() => setLightbox(item)}
                className="premium-card overflow-hidden cursor-pointer group aspect-square"
                data-testid="galeri-item">
                <div className="relative h-full">
                  <img src={item.url} alt={item.judul} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <div>
                      <Badge className="bg-gold text-emerald-900 hover:bg-gold text-[10px] mb-1">{item.kategori}</Badge>
                      <p className="text-white text-sm font-medium">{item.judul}</p>
                    </div>
                  </div>
                  {item.type === "video" && (
                    <PlayCircle className="absolute top-3 right-3 h-6 w-6 text-white drop-shadow" />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-16">Belum ada dokumentasi untuk kategori ini.</p>}
      </section>

      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightbox(null)} data-testid="galeri-lightbox">
            <button className="absolute top-6 right-6 text-white/80 hover:text-white" onClick={() => setLightbox(null)}>
              <X className="h-8 w-8" />
            </button>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
              <img src={lightbox.url} alt={lightbox.judul} className="w-full max-h-[80vh] object-contain rounded-2xl" />
              <div className="text-center mt-4">
                <Badge className="bg-gold text-emerald-900 hover:bg-gold mb-2">{lightbox.kategori}</Badge>
                <p className="text-white font-display text-xl">{lightbox.judul}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
