import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/admin/FileUpload";
import { Images, Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";

const KATS = ["Dzikir Rutin", "Hari Besar Islam", "Harlah", "Kegiatan Sosial"];

export default function GaleriAdmin() {
  const { isViewer } = useAuth();
  const canWrite = !isViewer;
  const [rows, setRows] = useState([]);
  const [cabang, setCabang] = useState([]);
  const [guru, setGuru] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [delTarget, setDelTarget] = useState(null);
  const [filterCabang, setFilterCabang] = useState("__all__");
  const [filterGuru, setFilterGuru] = useState("__all__");

  // Relasi Guru -> Cabang yang benar ada di Guru.cabang_ids (bukan Cabang.guru_id).
  const guruCabangIds = (guruId) => {
    const g = guru.find((x) => x.id === guruId);
    if (!g) return [];
    return g.cabang_ids || (g.cabang_id ? [g.cabang_id] : []);
  };

  const filteredRows = rows.filter((r) => {
    const matchCabang = filterCabang === "__all__" || r.cabang_id === filterCabang;
    const matchGuru = filterGuru === "__all__" || guruCabangIds(filterGuru).includes(r.cabang_id);
    return matchCabang && matchGuru;
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, c, gu] = await Promise.all([api.get("/galeri"), api.get("/cabang"), api.get("/guru")]);
      setRows(g.data); setCabang(c.data); setGuru(gu.data);
    }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ judul: "", kategori: "Dzikir Rutin", type: "photo", url: "", published: true }); setEditing(null); setOpen(true); };
  const openEdit = (r) => { setForm({ ...r }); setEditing(r); setOpen(true); };

  const save = async () => {
    if (!form.judul || !form.url) { toast.error("Judul dan URL wajib diisi"); return; }
    try {
      const payload = { judul: form.judul, kategori: form.kategori, type: form.type, url: form.url, published: form.published };
      if (editing) { await api.put(`/galeri/${editing.id}`, payload); toast.success("Item diperbarui"); }
      else { await api.post("/galeri", payload); toast.success("Item ditambahkan"); }
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const togglePublish = async (r) => {
    try { await api.put(`/galeri/${r.id}`, { published: !r.published }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try { await api.delete(`/galeri/${delTarget.id}`); toast.success("Item dihapus"); setDelTarget(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Images className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display text-charcoal">Galeri</h1>
            <p className="text-sm text-muted-foreground">Kelola & publikasikan dokumentasi ke situs publik</p>
          </div>
        </div>
        {canWrite && <Button onClick={openCreate} className="rounded-xl gap-2" data-testid="galeri-add-btn"><Plus className="h-4 w-4" /> Tambah Media</Button>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterCabang} onValueChange={setFilterCabang}>
          <SelectTrigger className="w-[180px] rounded-xl" data-testid="galeri-filter-cabang"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Cabang</SelectItem>
            {cabang.map((c) => <SelectItem key={c.id} value={c.id}>{c.kota}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterGuru} onValueChange={setFilterGuru}>
          <SelectTrigger className="w-[200px] rounded-xl" data-testid="galeri-filter-guru"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Semua Guru Pembimbing</SelectItem>
            {guru.map((g) => <SelectItem key={g.id} value={g.id}>{g.nama}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredRows.map((r) => (
            <div key={r.id} className="premium-card overflow-hidden group" data-testid="galeri-admin-item">
              <div className="relative aspect-square">
                <img src={r.url} alt={r.judul} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2"><Badge className="bg-gold text-emerald-900 hover:bg-gold text-[10px]">{r.kategori}</Badge></div>
                <div className="absolute top-2 right-2">
                  <Badge variant={r.published ? "default" : "secondary"} className="text-[10px]">{r.published ? "Publik" : "Draft"}</Badge>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-charcoal truncate">{r.judul}</p>
                {canWrite && (
                  <div className="flex items-center justify-between mt-2">
                    <Button variant="ghost" size="sm" className="h-8 px-2 gap-1" onClick={() => togglePublish(r)} data-testid="galeri-toggle-publish">
                      {r.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span className="text-xs">{r.published ? "Sembunyikan" : "Publikasi"}</span>
                    </Button>
                    <div className="flex">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 text-emerald-brand" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDelTarget(r)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredRows.length === 0 && <p className="text-muted-foreground col-span-full">Belum ada media.</p>}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => { if (next) setOpen(true); }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideClose
        >
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? "Edit" : "Tambah"} Media</DialogTitle>
            <DialogDescription className="sr-only">
              {editing ? "Ubah detail media galeri" : "Tambahkan media baru ke galeri"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label className="mb-1.5 block text-sm">Judul *</Label><Input value={form.judul || ""} onChange={(e) => setForm({ ...form, judul: e.target.value })} className="rounded-xl" data-testid="galeri-field-judul" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-sm">Kategori</Label>
                <Select value={form.kategori} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{KATS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">Tipe</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="photo">Foto</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            {form.type === "video" ? (
              // Video belum punya mekanisme upload sendiri — pertahankan input URL
              // seperti sebelumnya agar data/fungsi video lama tidak rusak.
              <div>
                <Label className="mb-1.5 block text-sm">URL Media (video) *</Label>
                <Input value={form.url || ""} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." className="rounded-xl" data-testid="galeri-field-url" />
              </div>
            ) : (
              <div>
                <Label className="mb-1.5 block text-sm">Foto Media *</Label>
                <FileUpload
                  value={form.url}
                  folder="galeri"
                  accept="image/*"
                  onChange={(v) => setForm({ ...form, url: v })}
                  testid="galeri-field-foto"
                />
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
              <Label className="text-sm">Publikasikan ke situs publik</Label>
              <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} data-testid="galeri-field-published" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} className="rounded-xl" data-testid="galeri-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus media ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="rounded-xl bg-destructive hover:bg-destructive/90" data-testid="galeri-confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
