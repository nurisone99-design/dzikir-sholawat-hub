import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from "recharts";
import {
  Building2, Users, GraduationCap, CalendarDays, UserPlus, Send, CalendarPlus,
  MapPin, ArrowUpRight,
} from "lucide-react";

const CARDS = [
  { key: "total_cabang", label: "Total Cabang", icon: Building2, color: "#0F766E" },
  { key: "total_guru", label: "Total Guru", icon: GraduationCap, color: "#C5A059" },
  { key: "total_jamaah", label: "Total Jamaah", icon: Users, color: "#0F766E" },
  { key: "active_events", label: "Agenda Aktif", icon: CalendarDays, color: "#C5A059" },
];

const PIE_COLORS = ["#0F766E", "#C5A059"];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/dashboard/stats").then((r) => setData(r.data)).catch(() => {}); }, []);

  const genderData = data ? [
    { name: "Laki-laki", value: data.gender.male },
    { name: "Perempuan", value: data.gender.female },
  ] : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-charcoal">
          Assalamu'alaikum, {user?.name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="text-muted-foreground mt-1">Ringkasan data Majelis Raudhatul Jannah hari ini.</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c, i) => (
          <motion.div key={c.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }} className="premium-card p-6" data-testid={`metric-${c.key}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: `${c.color}18` }}>
                <c.icon className="h-5 w-5" style={{ color: c.color }} />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            {data ? (
              <p className="text-3xl font-bold text-charcoal font-display">{data[c.key]}</p>
            ) : <Skeleton className="h-9 w-16" />}
            <p className="text-sm text-muted-foreground mt-1">{c.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Tambah Jamaah", icon: UserPlus, to: "/admin/jamaah" },
          { label: "Buat Agenda", icon: CalendarPlus, to: "/admin/agenda" },
          { label: "Broadcast WhatsApp", icon: Send, to: "/admin/agenda" },
        ].map((q) => (
          <button key={q.label} onClick={() => navigate(q.to)}
            className="premium-card p-5 flex items-center gap-4 text-left hover:-translate-y-1 transition-transform"
            data-testid={`quick-${q.label}`}>
            <div className="h-11 w-11 rounded-xl bg-gold/15 flex items-center justify-center">
              <q.icon className="h-5 w-5 text-gold" />
            </div>
            <span className="font-medium text-charcoal">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="premium-card p-6 lg:col-span-2">
          <h3 className="font-semibold text-charcoal mb-6">Jamaah per Cabang</h3>
          {data ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.per_cabang}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f2" vertical={false} />
                <XAxis dataKey="kota" tick={{ fontSize: 12, fill: "#4B5563" }} />
                <YAxis tick={{ fontSize: 12, fill: "#4B5563" }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                <Bar dataKey="jamaah" fill="#0F766E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Skeleton className="h-[280px] w-full" />}
        </div>

        <div className="premium-card p-6">
          <h3 className="font-semibold text-charcoal mb-6">Komposisi Gender</h3>
          {data ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {genderData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Skeleton className="h-[280px] w-full" />}
          <div className="flex justify-center gap-6 mt-2 text-sm">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#0F766E]" /> Laki-laki</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#C5A059]" /> Perempuan</span>
          </div>
        </div>
      </div>

      {/* Upcoming agenda */}
      <div className="premium-card p-6">
        <h3 className="font-semibold text-charcoal mb-5">Agenda Terdekat</h3>
        <div className="space-y-3">
          {data?.upcoming_agenda?.length ? data.upcoming_agenda.map((a) => (
            <div key={a.id} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/40">
              <div className="text-center bg-white rounded-lg px-3 py-2 border border-border shrink-0">
                <p className="text-lg font-bold text-primary font-display">{new Date(a.tanggal).getDate()}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{new Date(a.tanggal).toLocaleDateString("id-ID", { month: "short" })}</p>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-charcoal truncate">{a.judul}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {a.lokasi} • {a.waktu}</p>
              </div>
            </div>
          )) : <p className="text-muted-foreground text-sm">Tidak ada agenda mendatang.</p>}
        </div>
      </div>
    </div>
  );
}
