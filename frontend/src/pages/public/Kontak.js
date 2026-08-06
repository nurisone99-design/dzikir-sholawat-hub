import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Send,
  Instagram,
  Facebook,
  Youtube,
} from "lucide-react";

export default function Kontak() {
  const [s, setS] = useState({});
  const [form, setForm] = useState({ nama: "", whatsapp: "", pesan: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get("/public/settings")
      .then((r) => setS(r.data || {}))
      .catch((err) => {
        console.error("Gagal memuat informasi kontak:", err);

        setS({});
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nama || !form.whatsapp || !form.pesan) {
      toast.error("Mohon lengkapi semua kolom");
      return;
    }
    setLoading(true);
    try {
      await api.post("/public/contact", form);
      toast.success("Pesan Anda berhasil terkirim. Terima kasih!");
      setForm({ nama: "", whatsapp: "", pesan: "" });
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const waNumber = String(s.whatsapp || "").replace(/\D/g, "");

  return (
    <div>
      <section className="islamic-pattern relative">
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-5 rounded-full px-4 py-1.5">
            Hubungi Kami
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
            Kontak Yayasan
          </h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Sampaikan pertanyaan, saran, atau silaturahmi Anda kepada kami.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-2 gap-10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-display text-2xl font-bold text-charcoal mb-6">
            Informasi Kontak
          </h2>
          <div className="space-y-4">
            <div className="premium-card p-5 flex gap-4 items-start">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-charcoal">Alamat</p>
                <p className="text-sm text-muted-foreground">
                  {s.alamat || "-"}
                </p>
              </div>
            </div>
            <div className="premium-card p-5 flex gap-4 items-start">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-charcoal">Telepon</p>
                <p className="text-sm text-muted-foreground">
                  {s.telepon || "-"}
                </p>
              </div>
            </div>
            <div className="premium-card p-5 flex gap-4 items-start">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-charcoal">Email</p>
                <p className="text-sm text-muted-foreground">
                  {s.email || "-"}
                </p>
              </div>
            </div>
          </div>

          {waNumber && (
            <a
              href={`https://wa.me/${waNumber}?text=Assalamualaikum,%20saya%20ingin%20bertanya%20tentang%20Majelis%20Raudhatul%20Jannah`}
              target="_blank"
              rel="noreferrer"
            >
              <Button
                className="w-full mt-5 rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a] h-12"
                data-testid="kontak-wa-btn"
              >
                <MessageCircle className="h-5 w-5" /> Chat Langsung via WhatsApp
              </Button>
            </a>
          )}

          <div className="flex gap-3 mt-5">
            {s.instagram && (
              <a
                href={s.instagram}
                target="_blank"
                rel="noreferrer"
                className="h-11 w-11 rounded-xl bg-secondary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
            )}
            {s.facebook && (
              <a
                href={s.facebook}
                target="_blank"
                rel="noreferrer"
                className="h-11 w-11 rounded-xl bg-secondary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
              >
                <Facebook className="h-5 w-5" />
              </a>
            )}
            {s.youtube && (
              <a
                href={s.youtube}
                target="_blank"
                rel="noreferrer"
                className="h-11 w-11 rounded-xl bg-secondary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
              >
                <Youtube className="h-5 w-5" />
              </a>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="premium-card p-8 h-fit"
        >
          <h2 className="font-display text-2xl font-bold text-charcoal mb-6">
            Kirim Pesan
          </h2>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <Label className="mb-1.5 block">Nama Lengkap</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Nama Anda"
                className="rounded-xl"
                data-testid="kontak-nama"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">No. WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="0812xxxxxxx"
                className="rounded-xl"
                data-testid="kontak-whatsapp"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Pesan</Label>
              <Textarea
                value={form.pesan}
                onChange={(e) => setForm({ ...form, pesan: e.target.value })}
                rows={5}
                placeholder="Tuliskan pesan Anda..."
                className="rounded-xl"
                data-testid="kontak-pesan"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl gap-2 h-12"
              data-testid="kontak-submit"
            >
              <Send className="h-4 w-4" />{" "}
              {loading ? "Mengirim..." : "Kirim Pesan"}
            </Button>
          </form>
        </motion.div>
      </section>
    </div>
  );
}
