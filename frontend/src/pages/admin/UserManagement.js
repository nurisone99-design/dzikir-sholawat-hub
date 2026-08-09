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

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin_cabang", label: "Admin Cabang" },
  { value: "viewer", label: "Viewer" },
  { value: "penerus_ilmu", label: "Penerus Ilmu" },
  { value: "ketua_yayasan", label: "Ketua Yayasan" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

export default function UserManagement() {
  const { isSuper } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [delTarget, setDelTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/users"); setRows(data); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm({ username: "", email: "", password: "", role: "viewer", status: "active", name: "" }); setEditing(null); setOpen(true); };
  const openEdit = (r) => { setForm({ username: r.username, email: r.email, role: r.role, status: r.status, name: r.name, password: "" }); setEditing(r); setOpen(true); };

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-xl">{editing ? "Edit" : "Tambah"} User</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div><Label className="mb-1.5 block text-sm">Username *</Label><Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rounded-xl" data-testid="users-field-username" /></div>
            <div><Label className="mb-1.5 block text-sm">Nama</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" /></div>
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
