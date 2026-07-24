import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Settings, Save, Download, Upload, Building2, Bell, KeyRound, Database } from "lucide-react";

export default function Pengaturan() {
  const { isSuper } = useAuth();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setForm(r.data || {})).catch(() => {}); }, []);

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await api.put("/settings", form); toast.success("Pengaturan tersimpan"); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const backup = async () => {
    try {
      toast.loading("Menyiapkan backup...", { id: "bk" });
      const { data } = await api.get("/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `backup-raudhatuljannah-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup berhasil diunduh", { id: "bk" });
    } catch (e) { toast.error("Gagal membuat backup", { id: "bk" }); }
  };

  const restore = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post("/restore", json);
      toast.success("Database berhasil dipulihkan");
    } catch (e) { toast.error("Gagal memulihkan: file tidak valid"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><Settings className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold font-display text-charcoal">Pengaturan Sistem</h1>
          <p className="text-sm text-muted-foreground">Identitas yayasan, notifikasi & backup data</p>
        </div>
      </div>

      <Tabs defaultValue="identitas">
        <TabsList className="rounded-xl">
          <TabsTrigger value="identitas" className="rounded-lg gap-2"><Building2 className="h-4 w-4" /> Identitas</TabsTrigger>
          <TabsTrigger value="notif" className="rounded-lg gap-2"><Bell className="h-4 w-4" /> Notifikasi & WA</TabsTrigger>
          {isSuper && <TabsTrigger value="backup" className="rounded-lg gap-2"><Database className="h-4 w-4" /> Backup</TabsTrigger>}
        </TabsList>

        <TabsContent value="identitas" className="mt-6">
          <div className="premium-card p-8 max-w-3xl space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Nama Yayasan</Label><Input value={form.nama || ""} onChange={(e) => upd("nama", e.target.value)} className="rounded-xl" data-testid="setting-nama" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Nama Majelis</Label><Input value={form.nama_majelis || ""} onChange={(e) => upd("nama_majelis", e.target.value)} className="rounded-xl" /></div>
              <div className="sm:col-span-2"><Label className="mb-1.5 block text-sm">Alamat</Label><Input value={form.alamat || ""} onChange={(e) => upd("alamat", e.target.value)} className="rounded-xl" /></div>
              <div><Label className="mb-1.5 block text-sm">Email</Label><Input value={form.email || ""} onChange={(e) => upd("email", e.target.value)} className="rounded-xl" /></div>
              <div><Label className="mb-1.5 block text-sm">Telepon</Label><Input value={form.telepon || ""} onChange={(e) => upd("telepon", e.target.value)} className="rounded-xl" /></div>
              <div><Label className="mb-1.5 block text-sm">Instagram</Label><Input value={form.instagram || ""} onChange={(e) => upd("instagram", e.target.value)} className="rounded-xl" /></div>
              <div><Label className="mb-1.5 block text-sm">Facebook</Label><Input value={form.facebook || ""} onChange={(e) => upd("facebook", e.target.value)} className="rounded-xl" /></div>
              <div><Label className="mb-1.5 block text-sm">YouTube</Label><Input value={form.youtube || ""} onChange={(e) => upd("youtube", e.target.value)} className="rounded-xl" /></div>
            </div>
            <Button onClick={save} disabled={saving} className="rounded-xl gap-2" data-testid="setting-save"><Save className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
          </div>
        </TabsContent>

        <TabsContent value="notif" className="mt-6">
          <div className="premium-card p-8 max-w-3xl space-y-5">
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3">
              <div><Label className="text-sm font-medium">Notifikasi Email</Label><p className="text-xs text-muted-foreground">Kirim notifikasi via email untuk aktivitas penting</p></div>
              <Switch checked={!!form.notif_email} onCheckedChange={(v) => upd("notif_email", v)} />
            </div>
            <div><Label className="mb-1.5 block text-sm">No. WhatsApp Yayasan (Click-to-Chat)</Label><Input value={form.whatsapp || ""} onChange={(e) => upd("whatsapp", e.target.value)} placeholder="628xxxxxxxxxx" className="rounded-xl" /></div>
            <div>
              <Label className="mb-1.5 block text-sm flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> WhatsApp API Key (opsional)</Label>
              <Input value={form.wa_api_key || ""} onChange={(e) => upd("wa_api_key", e.target.value)} placeholder="Kosongkan jika menggunakan wa.me" className="rounded-xl" />
              <p className="text-xs text-muted-foreground mt-1.5">Broadcast saat ini menggunakan WhatsApp Click-to-Chat (wa.me) — tidak memerlukan API key.</p>
            </div>
            <Button onClick={save} disabled={saving} className="rounded-xl gap-2"><Save className="h-4 w-4" /> Simpan</Button>
          </div>
        </TabsContent>

        {isSuper && (
          <TabsContent value="backup" className="mt-6">
            <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
              <div className="premium-card p-8">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><Download className="h-5 w-5 text-primary" /></div>
                <h3 className="font-semibold text-charcoal">Backup Database</h3>
                <p className="text-sm text-muted-foreground mt-1.5 mb-5">Unduh seluruh data sistem dalam format JSON.</p>
                <Button onClick={backup} className="rounded-xl gap-2 w-full" data-testid="backup-btn"><Download className="h-4 w-4" /> Unduh Backup</Button>
              </div>
              <div className="premium-card p-8">
                <div className="h-12 w-12 rounded-xl bg-gold/15 flex items-center justify-center mb-4"><Upload className="h-5 w-5 text-gold" /></div>
                <h3 className="font-semibold text-charcoal">Restore Database</h3>
                <p className="text-sm text-muted-foreground mt-1.5 mb-5">Pulihkan data dari file backup JSON. Data lama akan diganti.</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="rounded-xl gap-2 w-full border-gold text-gold hover:bg-gold/5" data-testid="restore-btn"><Upload className="h-4 w-4" /> Pilih File Restore</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Pulihkan database?</AlertDialogTitle>
                      <AlertDialogDescription>Seluruh data saat ini akan digantikan oleh isi file backup. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <label className="rounded-xl cursor-pointer">
                          Pilih File
                          <input type="file" accept="application/json" className="hidden"
                            onChange={(e) => restore(e.target.files?.[0])} data-testid="restore-input" />
                        </label>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
