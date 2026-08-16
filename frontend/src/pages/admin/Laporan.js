import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canExportEntity } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Filter,
  Download,
  Image as ImageIcon,
} from "lucide-react";

const ENTITIES = [
  { value: "jamaah", label: "Data Jamaah" },
  { value: "guru", label: "Data Guru" },
  { value: "cabang", label: "Data Cabang" },
  { value: "pengurus", label: "Data Pengurus" },
  { value: "agenda", label: "Agenda Majelis" },
  { value: "galeri", label: "Galeri" },
  { value: "pengumuman", label: "Pengumuman" },
];

// Baca pesan error asli dari backend meskipun response diminta sebagai blob
// (mis. saat export gagal, backend tetap mengirim JSON {"detail": "..."} tapi
// axios membungkusnya sebagai Blob karena responseType: "blob"). Tanpa ini,
// semua kegagalan akan tampil sebagai pesan generik yang menutupi akar masalah.
async function resolveBlobErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (error.code === "ECONNABORTED") {
    return "Permintaan melebihi batas waktu. Coba lagi.";
  }
  const data = error.response?.data;
  if (!data) return "Tidak dapat terhubung ke server.";
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed?.detail) {
        return typeof parsed.detail === "string"
          ? parsed.detail
          : JSON.stringify(parsed.detail);
      }
    } catch (_e) {
      // Bukan JSON — biarkan fallback generik di bawah.
    }
  }
  return fallback;
}

export default function Laporan() {
  const { user } = useAuth();
  const entities = ENTITIES.filter((e) => canExportEntity(user?.role, e.value));
  const [entity, setEntity] = useState(entities[0]?.value || "jamaah");
  const [cabang, setCabang] = useState([]);
  const [guru, setGuru] = useState([]);
  const [cabangId, setCabangId] = useState("__all__");
  const [guruId, setGuruId] = useState("__all__");
  const [gender, setGender] = useState("__all__");
  const [presets, setPresets] = useState([]);
  const [preset, setPreset] = useState("default");
  const [fields, setFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [busy, setBusy] = useState(false);

  // Khusus Galeri: Galeri adalah kumpulan foto, bukan data tabular — lihat
  // bagian render terpisah di bawah (bukan preset/kolom/Excel-PDF).
  const [galeriPhotos, setGaleriPhotos] = useState([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [downloadingPhotos, setDownloadingPhotos] = useState(false);

  const isGaleri = entity === "galeri";

  // Relasi Guru -> Cabang yang benar ada di Guru.cabang_ids (bukan Cabang.guru_id).
  const guruCabangIds = (id) => {
    const g = guru.find((x) => x.id === id);
    if (!g) return [];
    return g.cabang_ids || (g.cabang_id ? [g.cabang_id] : []);
  };

  useEffect(() => {
    api
      .get("/cabang")
      .then((r) => setCabang(r.data))
      .catch((err) => {
        console.error("Gagal memuat data cabang:", err);
        setCabang([]);
      });
    api
      .get("/guru")
      .then((r) => setGuru(r.data))
      .catch((err) => {
        console.error("Gagal memuat data guru:", err);
        setGuru([]);
      });
  }, []);

  // Muat ulang preset/kolom (atau daftar foto untuk Galeri) setiap kali Jenis
  // Data berganti.
  useEffect(() => {
    setFields([]);
    setPresets([]);
    setSelectedFields([]);
    setGaleriPhotos([]);
    setSelectedPhotoIds([]);

    if (isGaleri) {
      api
        .get("/galeri")
        .then((r) => setGaleriPhotos(r.data || []))
        .catch((err) => {
          console.error("Gagal memuat data galeri:", err);
          setGaleriPhotos([]);
        });
      return;
    }

    api
      .get(`/export/fields/${entity}`)
      .then((r) => {
        const fieldList = r.data?.fields || [];
        const presetList = r.data?.presets || [];
        setFields(fieldList);
        setPresets(presetList);
        const firstKey = presetList[0]?.key || "default";
        setPreset(firstKey);
        const matched = presetList.find((p) => p.key === firstKey);
        setSelectedFields(
          matched ? matched.fields : fieldList.filter((f) => f.default).map((f) => f.key),
        );
      })
      .catch((err) => {
        console.error("Gagal memuat preset laporan:", err);
        setFields([]);
        setPresets([]);
        setSelectedFields([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const handlePresetChange = (key) => {
    setPreset(key);
    const matched = presets.find((p) => p.key === key);
    if (matched) setSelectedFields(matched.fields);
  };

  const toggleField = (key) => {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectAllFields = () => setSelectedFields(fields.map((f) => f.key));
  const clearAllFields = () => setSelectedFields([]);

  const filteredGaleriPhotos = galeriPhotos.filter((p) => {
    const matchCabang = cabangId === "__all__" || p.cabang_id === cabangId;
    const matchGuru = guruId === "__all__" || guruCabangIds(guruId).includes(p.cabang_id);
    return matchCabang && matchGuru;
  });

  const togglePhoto = (id) => {
    setSelectedPhotoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const selectAllPhotos = () => setSelectedPhotoIds(filteredGaleriPhotos.map((p) => p.id));
  const clearAllPhotos = () => setSelectedPhotoIds([]);

  const doExport = async (format) => {
    if (selectedFields.length === 0) {
      toast.error("Silakan pilih minimal satu kolom untuk diekspor.");
      return;
    }
    setBusy(true);
    try {
      const params = new URLSearchParams({ format, fields: selectedFields.join(",") });
      if (cabangId !== "__all__") params.append("cabang_id", cabangId);
      if (entity !== "guru" && guruId !== "__all__")
        params.append("guru_id", guruId);
      if (entity === "jamaah" && gender !== "__all__")
        params.append("gender", gender);
      toast.loading("Menyiapkan laporan...", { id: "rpt" });
      const res = await api.get(`/export/${entity}?${params.toString()}`, {
        responseType: "blob",
        // Pembuatan PDF/Excel untuk data besar bisa lebih lama dari timeout default;
        // jangan sampai laporan yang sebenarnya berhasil dibuat dianggap gagal
        // hanya karena permintaan di-timeout terlalu cepat di sisi klien.
        timeout: 60000,
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${entity}.${format === "xlsx" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("File berhasil dibuat dan diunduh.", { id: "rpt" });
    } catch (e) {
      const message = await resolveBlobErrorMessage(e, "Gagal membuat laporan.");
      toast.error(message, { id: "rpt" });
    } finally {
      setBusy(false);
    }
  };

  const doDownloadPhotos = async () => {
    if (selectedPhotoIds.length === 0) {
      toast.error("Silakan pilih minimal satu foto untuk diunduh.");
      return;
    }
    setDownloadingPhotos(true);
    try {
      toast.loading("Menyiapkan unduhan...", { id: "rpt-galeri" });
      const params = new URLSearchParams({ ids: selectedPhotoIds.join(",") });
      const res = await api.get(`/export/galeri/photos?${params.toString()}`, {
        responseType: "blob",
        timeout: 60000,
      });
      const isZip = selectedPhotoIds.length > 1;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = isZip ? "galeri.zip" : "foto.jpg";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        isZip
          ? `ZIP berisi ${selectedPhotoIds.length} foto berhasil diunduh.`
          : "Foto berhasil diunduh.",
        { id: "rpt-galeri" },
      );
    } catch (e) {
      const message = await resolveBlobErrorMessage(e, "Gagal mengunduh foto.");
      toast.error(message, { id: "rpt-galeri" });
    } finally {
      setDownloadingPhotos(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <FileBarChart className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-charcoal">
            Laporan & Data Export
          </h1>
          <p className="text-sm text-muted-foreground">
            Buat laporan terkustomisasi dalam format Excel & PDF
          </p>
        </div>
      </div>

      <div className="premium-card p-8 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="h-4 w-4 text-gold" />
          <h3 className="font-semibold text-charcoal">Parameter Laporan</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <Label className="mb-1.5 block text-sm">Jenis Data</Label>
            <Select
              value={entity}
              onValueChange={(v) => {
                setEntity(v);
                setCabangId("__all__");
                setGuruId("__all__");
                setGender("__all__");
              }}
            >
              <SelectTrigger
                className="rounded-xl"
                data-testid="laporan-entity"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entities.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isGaleri && presets.length > 0 && (
            <div>
              <Label className="mb-1.5 block text-sm">Preset Kolom</Label>
              <Select value={preset} onValueChange={handlePresetChange}>
                <SelectTrigger
                  className="rounded-xl"
                  data-testid="laporan-preset"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {entity !== "cabang" && (
            <div>
              <Label className="mb-1.5 block text-sm">Cabang</Label>
              <Select value={cabangId} onValueChange={setCabangId}>
                <SelectTrigger
                  className="rounded-xl"
                  data-testid="laporan-cabang"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Cabang</SelectItem>
                  {cabang.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.kota}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {entity !== "guru" && (
            <div>
              <Label className="mb-1.5 block text-sm">Guru Pembimbing</Label>
              <Select value={guruId} onValueChange={setGuruId}>
                <SelectTrigger
                  className="rounded-xl"
                  data-testid="laporan-guru"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Guru</SelectItem>
                  {guru.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {entity === "jamaah" && (
            <div>
              <Label className="mb-1.5 block text-sm">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger
                  className="rounded-xl"
                  data-testid="laporan-gender"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua</SelectItem>
                  <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                  <SelectItem value="Perempuan">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {!isGaleri && fields.length > 0 && (
          <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-charcoal">
                Kolom yang akan diekspor
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllFields}
                  className="text-xs text-primary hover:underline font-medium"
                  data-testid="laporan-select-all-fields"
                >
                  Pilih Semua
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={clearAllFields}
                  className="text-xs text-primary hover:underline font-medium"
                  data-testid="laporan-clear-all-fields"
                >
                  Kosongkan Semua
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2.5">
              {fields.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 text-sm text-charcoal cursor-pointer"
                >
                  <Checkbox
                    checked={selectedFields.includes(f.key)}
                    onCheckedChange={() => toggleField(f.key)}
                    data-testid={`laporan-field-${f.key}`}
                  />
                  <span className="truncate">{f.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {isGaleri && (
          <div className="mt-6 rounded-xl border border-border bg-secondary/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold text-charcoal">Pilih Foto</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllPhotos}
                  className="text-xs text-primary hover:underline font-medium"
                  data-testid="laporan-select-all-photos"
                >
                  Pilih Semua
                </button>
                <span className="text-muted-foreground text-xs">•</span>
                <button
                  type="button"
                  onClick={clearAllPhotos}
                  className="text-xs text-primary hover:underline font-medium"
                  data-testid="laporan-clear-all-photos"
                >
                  Kosongkan Semua
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto scrollbar-thin p-1">
              {filteredGaleriPhotos.map((p) => {
                const active = selectedPhotoIds.includes(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePhoto(p.id)}
                    className={`premium-card overflow-hidden text-left relative ring-offset-2 transition-all ${
                      active ? "ring-2 ring-primary" : ""
                    }`}
                    data-testid="laporan-photo-item"
                  >
                    <div
                      className="absolute top-2 left-2 z-10 bg-white/90 rounded p-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox checked={active} onCheckedChange={() => togglePhoto(p.id)} />
                    </div>
                    <div className="aspect-square">
                      <img src={p.url} alt={p.judul} className="w-full h-full object-cover" />
                    </div>
                    <p className="p-2 text-xs font-medium text-charcoal truncate">{p.judul}</p>
                  </button>
                );
              })}
              {filteredGaleriPhotos.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-6">
                  Tidak ada foto untuk filter ini.
                </p>
              )}
            </div>
          </div>
        )}

        {isGaleri ? (
          <div className="mt-8">
            <Button
              onClick={doDownloadPhotos}
              disabled={downloadingPhotos}
              className="rounded-xl gap-2 w-full h-12"
              data-testid="laporan-download-photos"
            >
              {selectedPhotoIds.length > 1 ? (
                <Download className="h-4 w-4" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {downloadingPhotos
                ? "Menyiapkan…"
                : selectedPhotoIds.length > 1
                  ? `Download ZIP (${selectedPhotoIds.length} Foto)`
                  : "Download Foto (JPEG)"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 mt-8">
            <Button
              onClick={() => doExport("xlsx")}
              disabled={busy}
              className="rounded-xl gap-2 flex-1 h-12"
              data-testid="laporan-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export Excel (.xlsx)
            </Button>
            <Button
              onClick={() => doExport("pdf")}
              disabled={busy}
              variant="outline"
              className="rounded-xl gap-2 flex-1 h-12 border-gold text-gold hover:bg-gold/5"
              data-testid="laporan-export-pdf"
            >
              <FileText className="h-4 w-4" /> Export PDF (Kop Yayasan)
            </Button>
          </div>
        )}
      </div>

      <div className="premium-card p-6 max-w-3xl bg-secondary/30">
        <div className="text-sm text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            Info
          </Badge>
          {isGaleri
            ? "Pilih satu foto untuk diunduh sebagai JPEG, atau beberapa foto sekaligus untuk diunduh sebagai satu file ZIP berisi JPEG."
            : "Laporan PDF menyertakan kop resmi Yayasan Raudhatul Jannah dengan desain rapi siap cetak. Laporan Excel dapat diolah lebih lanjut untuk kebutuhan administrasi."}
        </div>
      </div>
    </div>
  );
}
