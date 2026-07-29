import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";

export default function ExportDialog({
  open,
  onOpenChange,
  availableColumns = [],
  onExport,
}) {
  const [selectedCabang, setSelectedCabang] = useState("all");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [cabangList, setCabangList] = useState([]);

  // Fetch data cabang langsung dari API saat dialog dibuka
  useEffect(() => {
    if (open) {
      setSelectedColumns(availableColumns.map((c) => c.key));

      // Ambil daftar cabang dari backend
      api
        .get("/cabang")
        .then((res) => {
          setCabangList(res.data || []);
        })
        .catch((err) => {
          console.error("Gagal memuat data cabang:", err);
        });
    }
  }, [open, availableColumns]);

  const toggleColumn = (key) => {
    setSelectedColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(availableColumns.map((c) => c.key));
  };

  const handleExportClick = (format) => {
    onExport({
      format,
      cabang: selectedCabang,
      gender: selectedGender,
      columns: selectedColumns,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Opsi Ekspor Data Jamaah
          </DialogTitle>
          <DialogDescription>
            Pilih filter dan kolom data yang ingin disertakan pada file ekspor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Filter Cabang */}
          <div className="space-y-1.5">
            <Label>Cabang</Label>
            <Select value={selectedCabang} onValueChange={setSelectedCabang}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Semua Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                {cabangList.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nama || c.nama_cabang || c.kota || `Cabang ${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter Gender */}
          <div className="space-y-1.5">
            <Label>Gender / Jenis Kelamin</Label>
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Semua Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Gender</SelectItem>
                <SelectItem value="L">Laki-Laki</SelectItem>
                <SelectItem value="P">Perempuan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pilih Kolom / Informasi yang di-export */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Informasi / Kolom yang Dihasilkan</Label>
              <button
                type="button"
                onClick={selectAllColumns}
                className="text-xs text-primary hover:underline font-medium"
              >
                Pilih Semua
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-xl bg-muted/20 scrollbar-thin">
              {availableColumns.map((col) => {
                const active = selectedColumns.includes(col.key);
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggleColumn(col.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium border text-left transition-colors ${
                      active
                        ? "bg-primary text-white border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary"
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded border flex items-center justify-center shrink-0 ${
                        active
                          ? "bg-white border-white"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {active && (
                        <span className="h-1.5 w-1.5 rounded-sm bg-primary" />
                      )}
                    </span>
                    <span className="truncate">{col.label || col.header}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl"
          >
            Batal
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={() => handleExportClick("xlsx")}
              className="rounded-xl gap-1.5"
            >
              <Download className="h-4 w-4" /> Export Excel
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExportClick("pdf")}
              className="rounded-xl gap-1.5"
            >
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
