import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { canExportEntity } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileBarChart, FileSpreadsheet, FileText, Filter } from "lucide-react";

const ENTITIES = [
  { value: "jamaah", label: "Data Jamaah" },
  { value: "guru", label: "Data Guru" },
  { value: "cabang", label: "Data Cabang" },
  { value: "pengurus", label: "Data Pengurus" },
  { value: "agenda", label: "Agenda Majelis" },
];

export default function Laporan() {
  const { user } = useAuth();
  const entities = ENTITIES.filter((e) => canExportEntity(user?.role, e.value));
  const [entity, setEntity] = useState(entities[0]?.value || "jamaah");
  const [cabang, setCabang] = useState([]);
  const [cabangId, setCabangId] = useState("__all__");
  const [gender, setGender] = useState("__all__");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get("/cabang")
      .then((r) => setCabang(r.data))
      .catch((err) => {
        console.error("Gagal memuat data cabang:", err);

        setCabang([]);
      });
  }, []);

  const doExport = async (format) => {
    setBusy(true);
    try {
      const params = new URLSearchParams({ format });
      if (cabangId !== "__all__") params.append("cabang_id", cabangId);
      if (entity === "jamaah" && gender !== "__all__")
        params.append("gender", gender);
      toast.loading("Menyiapkan laporan...", { id: "rpt" });
      const res = await api.get(`/export/${entity}?${params.toString()}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan-${entity}.${format === "xlsx" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Laporan berhasil diunduh", { id: "rpt" });
    } catch (e) {
      toast.error("Gagal membuat laporan", { id: "rpt" });
    } finally {
      setBusy(false);
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

      <div className="premium-card p-8 max-w-2xl">
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
      </div>

      <div className="premium-card p-6 max-w-2xl bg-secondary/30">
        <p className="text-sm text-muted-foreground">
          <Badge variant="secondary" className="mr-2">
            Info
          </Badge>
          Laporan PDF menyertakan kop resmi Yayasan Raudhatul Jannah dengan
          desain rapi siap cetak. Laporan Excel dapat diolah lebih lanjut untuk
          kebutuhan administrasi.
        </p>
      </div>
    </div>
  );
}
