import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, User, Phone, Building2, MessageCircle } from "lucide-react";

const icon = new L.Icon({
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function Cabang() {
  const [cabang, setCabang] = useState([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    api
      .get("/public/cabang")
      .then((r) => setCabang(r.data))
      .catch((err) => {
        console.error("Gagal memuat data cabang:", err);

        setCabang([]);
      });

    setMapReady(true);
  }, []);

  const markers = cabang.filter((c) => c.lat && c.lng);
  const center = markers.length
    ? [markers[0].lat, markers[0].lng]
    : [-2.5, 118];

  return (
    <div>
      <section className="islamic-pattern relative">
        <div className="absolute inset-0 bg-emerald-950/80" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
          <Badge className="bg-gold/20 text-gold border border-gold/30 hover:bg-gold/20 mb-5 rounded-full px-4 py-1.5">
            Jaringan Majelis
          </Badge>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white">
            Informasi Cabang & Peta
          </h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Temukan cabang Majelis Raudhatul Jannah terdekat dari lokasi Anda.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div
          className="premium-card overflow-hidden mb-12"
          style={{ height: 420 }}
          data-testid="cabang-map"
        >
          {mapReady && (
            <MapContainer
              center={center}
              zoom={5}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {markers.map((c) => (
                <Marker key={c.id} position={[c.lat, c.lng]} icon={icon}>
                  <Popup>
                    <strong>{c.kota}</strong>
                    <br />
                    {c.alamat}
                    <br />
                    Ketua: {c.ketua}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cabang.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="premium-card p-6"
              data-testid="cabang-card"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <Badge variant="secondary" className="rounded-full text-xs">
                  {c.id_cabang}
                </Badge>
              </div>
              <h3 className="font-display text-xl font-bold text-charcoal">
                {c.kota}
              </h3>
              <div className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-gold" />{" "}
                  {c.alamat}
                </p>
                <p className="flex gap-2">
                  <User className="h-4 w-4 shrink-0 text-gold" /> {c.ketua}
                </p>
                <p className="flex gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-gold" /> {c.no_hp}
                </p>
              </div>
              <a
                href={`https://wa.me/${String(c.no_hp).replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  className="w-full mt-5 rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a]"
                  data-testid="cabang-wa-btn"
                >
                  <MessageCircle className="h-4 w-4" /> Hubungi via WhatsApp
                </Button>
              </a>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
