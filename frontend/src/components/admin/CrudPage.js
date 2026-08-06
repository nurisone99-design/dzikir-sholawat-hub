import ExportDialog from "@/components/admin/ExportDialog";
import { CustomDatePicker } from "@/components/ui/date-picker";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import MapPicker from "@/components/admin/MapPicker";
import FileUpload from "@/components/admin/FileUpload";

export default function CrudPage({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  searchKeys,
  filters = [],
  exportEntity,
  icon: Icon,
  extraOptions = {},
  lookups = [],
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/${endpoint}`);

      console.log("DATA GURU =", data);

      setRows(data);
    } catch (e) {
      toast.error(apiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  // load dynamic options for select fields (optionsFrom)
  useEffect(() => {
    const dyn = fields.filter((f) => f.optionsFrom);

    Promise.all(
      dyn.map(async (f) => {
        try {
          const { data } = await api.get(`/${f.optionsFrom}`);

          setOptions((o) => ({
            ...o,
            [f.key]: data.map((d) => ({
              value: d.id,
              label: d[f.optionLabel || "nama"],
            })),
          }));

          setRawOptions((o) => ({
            ...o,
            [f.key]: data,
          }));
        } catch (err) {
          console.error(`Gagal memuat opsi ${f.optionsFrom}:`, err);
        }
      }),
    );
  }, [fields]);

  // auto-generate id fields based on other selected fields (create mode only)
  useEffect(() => {
    if (!open || editing) return;
    fields.forEach((f) => {
      if (f.type === "auto_id" && f.compute) {
        const val = f.compute(form, rows, rawOptions);
        setForm((p) => (p[f.key] === val ? p : { ...p, [f.key]: val }));
      }
    });
  }, [open, editing, form, rows, rawOptions, fields]);

  // load lookup maps for foreign-key column display
  useEffect(() => {
    Promise.all(
      lookups.map(async (lk) => {
        try {
          const { data } = await api.get(`/${lk.from}`);
          const map = {};
          data.forEach((d) => {
            map[d.id] = d[lk.labelKey];
          });
          setLookupMaps((m) => ({ ...m, [lk.key]: map }));
        } catch (err) {
          console.error(`Gagal memuat lookup ${lk.from}:`, err);
        }
      }),
    );
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
      if (f.type === "map") {
        init[f.latKey || "lat"] = "";
        init[f.lngKey || "lng"] = "";
      } else if (f.type === "tags" || f.type === "checkbox_group")
        init[f.key] = [];
      else if (f.type === "dynamic_list") init[f.key] = [""];
      else init[f.key] = "";
    });
    setForm(init);
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (row) => {
    const init = {};
    fields.forEach((f) => {
      if (f.type === "map") {
        init[f.latKey || "lat"] = row[f.latKey || "lat"] ?? "";
        init[f.lngKey || "lng"] = row[f.lngKey || "lng"] ?? "";
      } else if (f.type === "dynamic_list") {
        init[f.key] =
          Array.isArray(row[f.key]) && row[f.key].length ? row[f.key] : [""];
      } else if (f.type === "tags" || f.type === "checkbox_group") {
        init[f.key] = Array.isArray(row[f.key]) ? row[f.key] : [];
      } else {
        init[f.key] = row[f.key] ?? "";
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
      if (f.type === "dynamic_list")
        payload[f.key] = (form[f.key] || [])
          .map((s) => s.trim())
          .filter(Boolean);
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

  const doExport = async ({
    format,
    cabang,
    gender,
    columns: selectedCols,
  }) => {
    if (!exportEntity) return;
    try {
      toast.loading("Menyiapkan file...", { id: "exp" });

      const params = new URLSearchParams({
        format,
        cabang: cabang || "all",
        gender: gender || "all",
        columns: selectedCols ? selectedCols.join(",") : "",
      });

      const res = await api.get(
        `/export/${exportEntity}?${params.toString()}`,
        {
          responseType: "blob",
        },
      );

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
    options: f.optionsFrom ? options[f.key] || [] : f.options,
  }));

  const toggleTag = (key, val) =>
    setForm((p) => ({
      ...p,
      [key]: p[key]?.includes(val)
        ? p[key].filter((x) => x !== val)
        : [...(p[key] || []), val],
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
            <h1 className="text-2xl font-bold font-display text-charcoal">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
        {canWrite && (
          <Button
            onClick={openCreate}
            className="rounded-xl gap-2"
            data-testid={`${endpoint}-add-btn`}
          >
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
        onExport={exportEntity ? () => setExportDialogOpen(true) : null}
        canWrite={canWrite}
        testidPrefix={endpoint}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Edit" : "Tambah"} {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Lengkapi formulir berikut lalu tekan Simpan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {fields.map((f) => {
              const opts = f.options || options[f.key] || [];
              const isFoto = f.key === "foto" || f.type === "file";

              return (
                <div
                  key={f.key}
                  className={`
                    ${f.full || f.type === "tags" || f.type === "dynamic_list" ? "sm:col-span-2" : ""}
                    ${f.rowSpan === 2 || isFoto ? "sm:row-span-2 sm:col-start-2 flex flex-col h-full" : ""}
                  `}
                >
                  <Label className="mb-1.5 block text-sm">
                    {f.label}{" "}
                    {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  {f.type === "select" ? (
                    <Select
                      value={form[f.key] || ""}
                      onValueChange={(v) =>
                        setForm((p) => ({ ...p, [f.key]: v }))
                      }
                    >
                      <SelectTrigger
                        className="rounded-xl"
                        data-testid={`${endpoint}-field-${f.key}`}
                      >
                        <SelectValue placeholder={`Pilih ${f.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea
                      value={form[f.key] || ""}
                      rows={3}
                      className="rounded-xl"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      data-testid={`${endpoint}-field-${f.key}`}
                    />
                  ) : f.type === "tags" ? (
                    <div className="flex flex-wrap gap-2">
                      {(f.tagOptions || []).map((t) => {
                        const active = form[f.key]?.includes(t);
                        return (
                          <button
                            type="button"
                            key={t}
                            onClick={() => toggleTag(f.key, t)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              active
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-charcoal border-border hover:border-primary"
                            }`}
                            data-testid={`${endpoint}-tag-${f.key}`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "auto_id" ? (
                    <Input
                      value={form[f.key] || ""}
                      disabled
                      readOnly
                      className="rounded-xl bg-secondary/60 font-mono text-charcoal"
                      placeholder="Otomatis dari Cabang & Gender"
                      data-testid={`${endpoint}-field-${f.key}`}
                    />
                  ) : f.type === "dynamic_list" ? (
                    <div className="space-y-2">
                      {(form[f.key] || [""]).map((val, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            value={val}
                            className="rounded-xl"
                            placeholder={
                              f.placeholder || `${f.label} ${idx + 1}`
                            }
                            onChange={(e) => {
                              const arr = [...(form[f.key] || [""])];
                              arr[idx] = e.target.value;
                              setForm((p) => ({ ...p, [f.key]: arr }));
                            }}
                            data-testid={`${endpoint}-field-${f.key}-${idx}`}
                          />
                          {(form[f.key] || []).length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0"
                              onClick={() =>
                                setForm((p) => ({
                                  ...p,
                                  [f.key]: p[f.key].filter((_, i) => i !== idx),
                                }))
                              }
                              data-testid={`${endpoint}-remove-${f.key}`}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1.5 border-gold text-gold hover:bg-gold/5"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            [f.key]: [...(p[f.key] || [""]), ""],
                          }))
                        }
                        data-testid={`${endpoint}-add-${f.key}`}
                      >
                        <Plus className="h-4 w-4" />{" "}
                        {f.addLabel || `Tambah ${f.label}`}
                      </Button>
                    </div>
                  ) : f.type === "checkbox_group" ? (
                    <div className="flex flex-wrap gap-2">
                      {(f.options || options[f.key] || []).map((o) => {
                        const val = typeof o === "string" ? o : o.value;
                        const lab = typeof o === "string" ? o : o.label;
                        const active = (form[f.key] || []).includes(val);
                        return (
                          <button
                            type="button"
                            key={val}
                            onClick={() => toggleTag(f.key, val)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                              active
                                ? "bg-primary text-white border-primary"
                                : "bg-white text-charcoal border-border hover:border-primary"
                            }`}
                            data-testid={`${endpoint}-cb-${f.key}`}
                          >
                            <span
                              className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${active ? "bg-white border-white" : "border-muted-foreground/40"}`}
                            >
                              {active && (
                                <span className="h-1.5 w-1.5 rounded-sm bg-primary" />
                              )}
                            </span>
                            {lab}
                          </button>
                        );
                      })}
                    </div>
                  ) : f.type === "map" ? (
                    <MapPicker
                      value={{
                        lat: form[f.latKey || "lat"],
                        lng: form[f.lngKey || "lng"],
                      }}
                      onChange={({ lat, lng }) =>
                        setForm((p) => ({
                          ...p,
                          [f.latKey || "lat"]: lat,
                          [f.lngKey || "lng"]: lng,
                        }))
                      }
                    />
                  ) : f.type === "file" ? (
                    <div className="flex-1 w-full min-h-[160px] h-full flex flex-col">
                      <FileUpload
                        value={form[f.key]}
                        folder={endpoint}
                        accept={f.accept}
                        aspect={f.aspect}
                        onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                        testid={`${endpoint}-file-${f.key}`}
                      />
                    </div>
                  ) : f.type === "date" ? (
                    <CustomDatePicker
                      value={form[f.key]}
                      onChange={(v) => setForm((p) => ({ ...p, [f.key]: v }))}
                    />
                  ) : (
                    <Input
                      type={f.type === "number" ? "number" : "text"}
                      value={form[f.key] ?? ""}
                      className="rounded-xl"
                      onChange={(e) =>
                        setForm((p) => ({ ...p, [f.key]: e.target.value }))
                      }
                      data-testid={`${endpoint}-field-${f.key}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl"
            >
              Batal
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="rounded-xl"
              data-testid={`${endpoint}-save-btn`}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        cabangOptions={
          options.cabang_id || options.cabang || rawOptions.cabang_id || []
        }
        availableColumns={[
          ...columns,
          ...fields
            .filter((f) => !columns.some((c) => c.key === f.key))
            .map((f) => ({ key: f.key, label: f.label })),
        ]}
        onExport={doExport}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini permanen dan tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
              data-testid={`${endpoint}-confirm-delete`}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { Badge, X };
