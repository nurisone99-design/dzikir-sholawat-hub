import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DataTable from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Plus } from "lucide-react";

// Penerus Ilmu & Ketua Yayasan sengaja tidak lagi ditawarkan di form Tambah/Edit
// User — keduanya sudah diwakili oleh role gabungan Viewer 1. User lama dengan
// role ini di database TIDAK diubah/dimigrasi; ROLE_LABEL tetap mengenalinya
// (mis. untuk kolom "Hak Akses" di tabel) walau tidak lagi bisa dipilih di form.
const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin_cabang", label: "Admin Cabang" },
  { value: "viewer", label: "Viewer" },
  { value: "viewer_1", label: "Viewer 1" },
  { value: "viewer_2", label: "Viewer 2" },
];
const ROLE_LABEL = {
  ...Object.fromEntries(ROLES.map((r) => [r.value, r.label])),
  penerus_ilmu: "Penerus Ilmu",
  ketua_yayasan: "Ketua Yayasan",
};

export default function UserManagement() {
  const { isSuper } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [delTarget, setDelTarget] = useState(null);
  // Referensi Jamaah + Guru untuk auto-isi Nama saat admin mengetik ID (D2).
  const [refRecords, setRefRecords] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/users"); setRows(data); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([api.get("/jamaah"), api.get("/guru")])
      .then(([jamaah, guru]) => {
        setRefRecords([
          ...(jamaah.data || []).map((j) => ({ id: j.id_jamaah, nama: j.nama })),
          ...(guru.data || []).map((g) => ({ id: g.id_guru, nama: g.nama })),
        ]);
      })
      .catch((err) => console.error("Gagal memuat referensi Jamaah/Guru:", err));
  }, []);

  const openCreate = () => { setForm({ username: "", email: "", password: "", role: "viewer", status: "active", name: "", ref_id: "" }); setEditing(null); setOpen(true); };
  const openEdit = (r) => { setForm({ username: r.username, email: r.email, role: r.role, status: r.status, name: r.name, ref_id: r.ref_id || "", password: "" }); setEditing(r); setOpen(true); };

  const handleRefIdChange = (value) => {
    const match = refRecords.find(
      (r) => r.id && r.id.toLowerCase() === value.trim().toLowerCase(),
    );
    setForm((p) => ({
      ...p,
      ref_id: value,
      // Jika ID ditemukan, Nama otomatis terisi; jika tidak ditemukan/dikosongkan,
      // Nama tetap bisa diisi manual (tidak dipaksa/dikosongkan).
      ...(match ? { name: match.nama } : {}),
    }));
  };

  const save = async () => {
    if (!form.username || !form.email || (!editing && !form.password)) { toast.error("Lengkapi username, email, dan kata sandi"); return; }
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      if (editing) { await api.put(`/users/${editing.id}`, payload); toast.success("User diperbarui"); }
      else { await api.post("/users", payload); toast.success("User ditambahkan"); }
      setOpen(false); load();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  const doDelete = async () => {
    try { await api.delete(`/users/${delTarget.id}`); toast.success("User dihapus"); setDelTarget(null); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (!isSuper) return <p className="text-muted-foreground">Hanya Super Admin yang dapat mengakses halaman ini.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold font-display text-charcoal">Manajemen User</h1>
            <p className="text-sm text-muted-foreground">Kelola akun & hak akses admin</p>
          </div>
        </div>
        <Button onClick={openCreate} className="rounded-xl gap-2" data-testid="users-add-btn"><Plus className="h-4 w-4" /> Tambah User</Button>
      </div>

      <DataTable
        columns={[
          { key: "username", label: "Username" },
          { key: "email", label: "Email" },
          { key: "name", label: "Nama" },
          { key: "role", label: "Hak Akses", render: (r) => <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10">{ROLE_LABEL[r.role]}</Badge> },
          { key: "status", label: "Status", render: (r) => <Badge variant={r.status === "active" ? "default" : "secondary"} className="rounded-full">{r.status === "active" ? "Aktif" : "Nonaktif"}</Badge> },
        ]}
        rows={rows} loading={loading} searchKeys={["username", "email", "name"]}
        onEdit={openEdit} onDelete={setDelTarget} selectable={false} testidPrefix="users"
      />

      <Dialog open={open} onOpenChange={(next) => { if (next) setOpen(true); }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          hideClose
        >
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Edit" : "Tambah"} User</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div><Label className="mb-1.5 block text-sm">Username *</Label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-xl" data-testid="users-field-username" /></div>
            <div>
              <Label className="mb-1.5 block text-sm">ID Jamaah/Guru (Opsional)</Label>
              <Input
                value={form.ref_id || ""}
                onChange={(e) => handleRefIdChange(e.target.value)}
                placeholder="Contoh: JMH-0001 / GUR-0001"
                className="rounded-xl"
                data-testid="users-field-ref-id"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 block text-sm">Nama {!form.ref_id && "(isi manual jika tanpa ID)"}</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" data-testid="users-field-name" />
            </div>
            <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Email *</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" data-testid="users-field-email" /></div>
            <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Kata Sandi {editing && "(kosongkan jika tidak diubah)"} {!editing && "*"}</Label><Input type="password" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl" data-testid="users-field-password" /></div>
            <div>
              <Label className="mb-1.5 block text-sm">Hak Akses *</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="rounded-xl" data-testid="users-field-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Aktif</SelectItem><SelectItem value="inactive">Nonaktif</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} className="rounded-xl" data-testid="users-save-btn">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus user ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="rounded-xl bg-destructive hover:bg-destructive/90" data-testid="users-confirm-delete">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
