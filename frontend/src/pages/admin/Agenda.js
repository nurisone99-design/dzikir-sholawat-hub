import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarDays, Plus, MapPin, Clock, MessageCircle, Pencil, Trash2, Users,
} from "lucide-react";

export default function Agenda() {
  const { isViewer } = useAuth();
  const canWrite = !isViewer;
  const [rows, setRows] = useState([]);
  const [cabang, setCabang] = useState([]);
  const [jamaah, setJamaah] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [delTarget, setDelTarget] = useState(null);
  const [broadcast, setBroadcast] = useState(null);
  const [bcCabang, setBcCabang] = useState("__all__");

  const cabangMap = Object.fromEntries(cabang.map((c) => [c.id, c.kota]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, c, j] = await Promise.all([api.get("/agenda"), api.get("/cabang"), api.get("/jamaah")]);
      setRows(a.data); setCabang(c.data); setJamaah(j.data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ judul: "", tanggal: "", waktu: "", cabang_id: "", lokasi: "", deskripsi: "", target: "Semua Jamaah" }); setEditing(null); setOpen(true); };
  const openEdit = (r) => { setForm({ judul: r.judul, tanggal: r.tanggal, waktu: r.waktu, cabang_id: r.cabang_id, lokasi: r.lokasi, deskripsi: r.deskripsi, target: r.target }); setEditing(r); setOpen(true); };

  const save = async () => {
    if (!form.judul || !form.tanggal) { toast.error("Judul dan tanggal wajib diisi"); return; }
    try {
      if (editing) { await api.put(`/agenda/${editing.id}`, form); toast.success("Agenda diperbarui"); }
      else { await api.post("/agenda", form); toast.success("Agenda ditambahkan"); }
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try { await api.delete(`/agenda/${delTarget.id}`); toast.success("Agenda dihapus"); setDelTarget(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const sendBroadcast = (targetJamaah) => {
    const a = broadcast;
    const msg = encodeURIComponent(
      `*Undangan Majelis Raudhatul Jannah*\n\n` +
      `📌 *${a.judul}*\n` +
      `🗓️ ${new Date(a.tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}\n` +
      `⏰ ${a.waktu}\n📍 ${a.lokasi}\n\n${a.deskripsi}\n\nBarakallahu fiikum 🤲`
    );
    const num = String(targetJamaah?.no_hp || targetJamaah?.nik || "").replace(/\D/g, "");
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  const filteredJamaah = bcCabang === "__all__" ? jamaah : jamaah.filter((j) => j.cabang_id === bcCabang);

  const sorted = [...rows].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display text-charcoal">Agenda Majelis</h1>
            <p className="text-sm text-muted-foreground">Kelola agenda & broadcast WhatsApp ke jamaah</p>
          </div>
        </div>
        {canWrite && <Button onClick={openCreate} className="rounded-xl gap-2" data-testid="agenda-add-btn"><Plus className="h-4 w-4" /> Buat Agenda</Button>}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {sorted.map((a) => (
            <div key={a.id} className="premium-card p-6" data-testid="agenda-card">
              <div className="flex items-start justify-between">
                <Badge className="bg-gold/15 text-gold hover:bg-gold/15 rounded-full">{cabangMap[a.cabang_id] || "Umum"}</Badge>
                {canWrite && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="h-4 w-4 text-emerald-brand" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDelTarget(a)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                )}
              </div>
              <h3 className="font-display text-xl font-bold text-charcoal mt-3">{a.judul}</h3>
              <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /> {new Date(a.tanggal).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /> {a.waktu}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {a.lokasi}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{a.deskripsi}</p>
              <Button onClick={() => { setBroadcast(a); setBcCabang("__all__"); }}
                className="w-full mt-4 rounded-xl gap-2 bg-[#25D366] hover:bg-[#20bd5a]" data-testid="agenda-broadcast-btn">
                <MessageCircle className="h-4 w-4" /> Kirim Broadcast WhatsApp
              </Button>
            </div>
          ))}
          {sorted.length === 0 && <p className="text-muted-foreground">Belum ada agenda.</p>}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={open} onOpenChange={(next) => { if (next) setOpen(true); }}>
        <DialogContent
          className="max-w-lg"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Edit" : "Buat"} Agenda</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="mb-1.5 block text-sm">Judul Agenda *</Label><Input value={form.judul || ""} onChange={(e) => setForm({ ...form, judul: e.target.value })} className="rounded-xl" data-testid="agenda-field-judul" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label className="mb-1.5 block text-sm">Tanggal *</Label><Input type="date" value={form.tanggal || ""} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} className="rounded-xl" data-testid="agenda-field-tanggal" /></div>
              <div><Label className="mb-1.5 block text-sm">Waktu</Label><Input type="time" value={form.waktu || ""} onChange={(e) => setForm({ ...form, waktu: e.target.value })} className="rounded-xl" /></div>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Cabang/Lokasi</Label>
              <Select value={form.cabang_id} onValueChange={(v) => setForm({ ...form, cabang_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
                <SelectContent>{cabang.map((c) => <SelectItem key={c.id} value={c.id}>{c.kota}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="mb-1.5 block text-sm">Lokasi Detail</Label><Input value={form.lokasi || ""} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} className="rounded-xl" /></div>
            <div><Label className="mb-1.5 block text-sm">Deskripsi</Label><Textarea rows={3} value={form.deskripsi || ""} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} className="rounded-xl" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} className="rounded-xl" data-testid="agenda-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast dialog */}
      <Dialog open={!!broadcast} onOpenChange={(o) => !o && setBroadcast(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-xl flex items-center gap-2"><MessageCircle className="h-5 w-5 text-[#25D366]" /> Broadcast WhatsApp</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl bg-secondary/50 p-4 text-sm">
              <p className="font-semibold text-charcoal">{broadcast?.judul}</p>
              <p className="text-muted-foreground mt-1">Pesan undangan akan otomatis tersusun untuk tiap jamaah.</p>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Filter Jamaah per Cabang</Label>
              <Select value={bcCabang} onValueChange={setBcCabang}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Cabang</SelectItem>
                  {cabang.map((c) => <SelectItem key={c.id} value={c.id}>{c.kota}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {filteredJamaah.length} jamaah menjadi target broadcast
            </div>
            <div className="max-h-52 overflow-y-auto scrollbar-thin space-y-2 border rounded-xl p-2">
              {filteredJamaah.map((j) => (
                <div key={j.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary/50">
                  <div><p className="text-sm font-medium text-charcoal">{j.nama}</p><p className="text-xs text-muted-foreground">{cabangMap[j.cabang_id]}</p></div>
                  <Button size="sm" variant="outline" className="rounded-lg gap-1.5 h-8"
                    onClick={() => sendBroadcast(j)} data-testid="broadcast-send-single">
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> Kirim
                  </Button>
                </div>
              ))}
              {filteredJamaah.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Tidak ada jamaah di cabang ini.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus agenda ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="rounded-xl bg-destructive hover:bg-destructive/90" data-testid="agenda-confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
