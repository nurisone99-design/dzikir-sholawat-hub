import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DataTable from "@/components/admin/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export default function CrudPage({
  title, subtitle, endpoint, columns, fields, searchKeys, filters = [],
  exportEntity, icon: Icon, extraOptions = {}, lookups = [],
}) {
  const { isViewer } = useAuth();
  const canWrite = !isViewer;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [options, setOptions] = useState(extraOptions);
  const [rawOptions, setRawOptions] = useState({});
  const [lookupMaps, setLookupMaps] = useState({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/${endpoint}`);
      setRows(data);
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => { load(); }, [load]);

  // load dynamic options for select fields (optionsFrom)
  useEffect(() => {
    const dyn = fields.filter((f) => f.optionsFrom);
    dyn.forEach(async (f) => {
      try {
        const { data } = await api.get(`/${f.optionsFrom}`);
        setOptions((o) => ({
          ...o,
          [f.key]: data.map((d) => ({ value: d.id, label: d[f.optionLabel || "nama"] })),
        }));
      } catch (_) {}
    });
  }, [fields]);

  // load lookup maps for foreign-key column display
  useEffect(() => {
    lookups.forEach(async (lk) => {
      try {
        const { data } = await api.get(`/${lk.from}`);
        const map = {};
        data.forEach((d) => { map[d.id] = d[lk.labelKey]; });
        setLookupMaps((m) => ({ ...m, [lk.key]: map }));
      } catch (_) {}
    });
  }, [lookups]);

  const resolvedColumns = columns.map((c) => {
    const lk = lookups.find((l) => l.key === c.key);
    if (lk && !c.render) {
      return { ...c, render: (r) => lookupMaps[c.key]?.[r[c.key]] || "-" };
    }
    return c;
  });

  const openCreate = () => {
    const init = {};
    fields.forEach((f) => {
      init[f.key] = f.type === "tags" ? [] : f.type === "dynamic_list" ? [""] : "";
    });
    setForm(init);
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    const init = {};
    fields.forEach((f) => {
      if (f.type === "dynamic_list") {
        init[f.key] = Array.isArray(row[f.key]) && row[f.key].length ? row[f.key] : [""];
      } else {
        init[f.key] = row[f.key] ?? (f.type === "tags" ? [] : "");
      }
    });
    setForm(init);
    setEditing(row);
    setOpen(true);
  };

  const save = async () => {
    for (const f of fields) {
      if (f.required && (form[f.key] === "" || form[f.key] == null)) {
        toast.error(`${f.label} wajib diisi`);
        return;
      }
    }
    setSaving(true);
    const payload = { ...form };
    fields.forEach((f) => {
      if (f.type === "number") payload[f.key] = Number(payload[f.key] || 0);
      if (f.type === "dynamic_list") payload[f.key] = (form[f.key] || []).map((s) => s.trim()).filter(Boolean);
    });
    try {
      if (editing) {
        await api.put(`/${endpoint}/${editing.id}`, payload);
        toast.success("Data berhasil diperbarui");
      } else {
        await api.post(`/${endpoint}`, payload);
        toast.success("Data berhasil ditambahkan");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/${endpoint}/${deleteTarget.id}`);
      toast.success("Data dihapus");
      setDeleteTarget(null);
      load();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    }
  };

  const bulkDelete = async (ids) => {
    try {
      await api.post(`/${endpoint}/bulk-delete`, { ids });
      toast.success(`${ids.length} data dihapus`);
      load();
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    }
  };

  const doExport = async (format) => {
    if (!exportEntity) return;
    try {
      toast.loading("Menyiapkan file...", { id: "exp" });
      const res = await api.get(`/export/${exportEntity}?format=${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportEntity}.${format === "xlsx" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File berhasil diunduh", { id: "exp" });
    } catch (e) {
      toast.error("Gagal mengekspor", { id: "exp" });
    }
  };

  const resolvedFilters = filters.map((f) => ({
    ...f,
    options: f.optionsFrom ? (options[f.key] || []) : f.options,
  }));

  const toggleTag = (key, val) =>
    setForm((p) => ({
      ...p,
      [key]: p[key]?.includes(val) ? p[key].filter((x) => x !== val) : [...(p[key] || []), val],
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold font-display text-charcoal">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {canWrite && (
          <Button onClick={openCreate} className="rounded-xl gap-2" data-testid={`${endpoint}-add-btn`}>
            <Plus className="h-4 w-4" /> Tambah Data
          </Button>
        )}
      </div>

      <DataTable
        columns={resolvedColumns}
        rows={rows}
        loading={loading}
        searchKeys={searchKeys}
        filters={resolvedFilters}
        onEdit={openEdit}
        onDelete={setDeleteTarget}
        onBulkDelete={bulkDelete}
        onExport={exportEntity ? doExport : null}
        canWrite={canWrite}
        testidPrefix={endpoint}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Edit" : "Tambah"} {title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {fields.map((f) => {
              const opts = f.options || options[f.key] || [];
              return (
                <div key={f.key} className={f.full || f.type === "tags" || f.type === "textarea" || f.type === "dynamic_list" ? "sm:col-span-2" : ""}>
                  <Label className="mb-1.5 block text-sm">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.type === "select" ? (
                    <Select value={form[f.key] || ""} onValueChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}>
                      <SelectTrigger className="rounded-xl" data-testid={`${endpoint}-field-${f.key}`}>
                        <SelectValue placeholder={`Pilih ${f.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea value={form[f.key] || ""} rows={3} className="rounded-xl"
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      data-testid={`${endpoint}-field-${f.key}`} />
                  ) : f.type === "tags" ? (
                    <div className="flex flex-wrap gap-2">
                      {(f.tagOptions || []).map((t) => {
                        const active = form[f.key]?.includes(t);
                        return (
                          <button type="button" key={t}
                            onClick={() => toggleTag(f.key, t)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              active ? "bg-primary text-white border-primary" : "bg-white text-charcoal border-border hover:border-primary"
                            }`}
                            data-testid={`${endpoint}-tag-${f.key}`}>
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "auto_id" ? (
                    <Input value={form[f.key] || ""} disabled readOnly
                      className="rounded-xl bg-secondary/60 font-mono text-charcoal"
                      placeholder="Otomatis dari Cabang & Gender"
                      data-testid={`${endpoint}-field-${f.key}`} />
                  ) : f.type === "dynamic_list" ? (
                    <div className="space-y-2">
                      {(form[f.key] || [""]).map((val, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input value={val} className="rounded-xl"
                            placeholder={f.placeholder || `${f.label} ${idx + 1}`}
                            onChange={(e) => {
                              const arr = [...(form[f.key] || [""])];
                              arr[idx] = e.target.value;
                              setForm((p) => ({ ...p, [f.key]: arr }));
                            }}
                            data-testid={`${endpoint}-field-${f.key}-${idx}`} />
                          {(form[f.key] || []).length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0"
                              onClick={() => setForm((p) => ({ ...p, [f.key]: p[f.key].filter((_, i) => i !== idx) }))}
                              data-testid={`${endpoint}-remove-${f.key}`}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5 border-gold text-gold hover:bg-gold/5"
                        onClick={() => setForm((p) => ({ ...p, [f.key]: [...(p[f.key] || [""]), ""] }))}
                        data-testid={`${endpoint}-add-${f.key}`}>
                        <Plus className="h-4 w-4" /> {f.addLabel || `Tambah ${f.label}`}
                      </Button>
                    </div>
                  ) : (
                    <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={form[f.key] ?? ""} className="rounded-xl"
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      data-testid={`${endpoint}-field-${f.key}`} />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl">Batal</Button>
            <Button onClick={save} disabled={saving} className="rounded-xl" data-testid={`${endpoint}-save-btn`}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini permanen dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
              data-testid={`${endpoint}-confirm-delete`}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { Badge, X };
