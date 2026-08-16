import React, { useEffect, useState } from "react";
import CrudPage from "@/components/admin/CrudPage";
import { UserCog, User, Phone, MapPin, Building, Briefcase } from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import api from "@/lib/api";

const computePengurusId = (form, rows) =>
  `PGR-${String(rows.length + 1).padStart(4, "0")}`;

export default function DataPengurus() {
  const [selectedPengurus, setSelectedPengurus] = useState(null);
  const [cabangOptions, setCabangOptions] = useState([]);

  useEffect(() => {
    api
      .get("/cabang")
      .then((res) => {
        const list = res.data || [];
        setCabangOptions(
          list.map((c) => ({ value: c.id, label: c.kota || c.nama || "Cabang" })),
        );
      })
      .catch((err) => console.error("Gagal memuat data cabang:", err));
  }, []);

  const cabangName = (id) =>
    cabangOptions.find((c) => c.value === id)?.label || "-";

  return (
    <>
      <CrudPage
        title="Data Pengurus"
        subtitle="Kelola susunan pengurus yayasan & majelis"
        endpoint="pengurus"
        icon={UserCog}
        // Export Data Pengurus tersedia lewat menu "Laporan & Export", bukan tombol
        // Excel/PDF di halaman ini — lihat pages/admin/Laporan.js.
        searchKeys={["id_pengurus", "nama", "jabatan"]}
        lookups={[{ key: "cabang_id", from: "cabang", labelKey: "kota" }]}
        filters={[{ key: "cabang_id", label: "Cabang", optionsFrom: "cabang" }]}
        columns={[
          {
            key: "id_pengurus",
            label: "ID Pengurus",
            render: (r) => (
              <button
                type="button"
                onClick={() => setSelectedPengurus(r)}
                className="font-mono font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                {r.id_pengurus}
              </button>
            ),
          },
          { key: "nama", label: "Nama Pengurus" },
          { key: "jabatan", label: "Jabatan" },
          { key: "cabang_id", label: "Cabang Majelis" },
          { key: "no_hp", label: "No. HP/WA" },
        ]}
        fields={[
          {
            key: "id_pengurus",
            label: "ID Pengurus",
            type: "auto_id",
            compute: computePengurusId,
            required: true,
          },
          {
            key: "jamaah_id",
            label: "ID Jamaah (opsional)",
            type: "id_lookup",
            placeholder: "Masukkan ID Jamaah, contoh: JMH-0001",
            // Lookup langsung ke database (bukan mencocokkan daftar Jamaah yang
            // kebetulan sudah termuat di frontend) — lihat GET /jamaah/lookup/{id}.
            lookupUrl: (value) => `/jamaah/lookup/${encodeURIComponent(value)}`,
            notFoundMessage: "ID Jamaah tidak ditemukan.",
            onFound: (j) => ({
              nama: j.nama || "",
              cabang_id: j.cabang_id || j.id_cabang || j.cabang || "",
            }),
          },
          {
            key: "nama",
            label: "Nama Pengurus",
            type: "text",
            required: true,
            // Read-only saat ID Jamaah valid ditemukan, agar Nama tidak berbeda
            // dari data Jamaah. Kosongkan ID Jamaah untuk mengisi Nama manual.
            lockedBy: "jamaah_id",
          },
          { key: "jabatan", label: "Jabatan di Yayasan", type: "text", required: true },
          {
            key: "cabang_id",
            label: "Cabang Majelis",
            type: "select",
            optionsFrom: "cabang",
            optionLabel: "kota",
            required: true,
          },
          { key: "alamat", label: "Alamat", type: "textarea" },
          { key: "no_hp", label: "No. HP/WA", type: "text" },
        ]}
      />

      {/* Pop-up Kartu Detail Pengurus */}
      <Dialog
        open={!!selectedPengurus}
        onOpenChange={() => setSelectedPengurus(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <DialogTitle className="sr-only">Detail Pengurus</DialogTitle>
          <DialogDescription className="sr-only">
            Kartu informasi lengkap pengurus.
          </DialogDescription>
          {selectedPengurus && (
            <div className="bg-white">
              <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 text-white relative">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-200/50 flex items-center justify-center shrink-0">
                    <User className="w-8 h-8 text-emerald-200/60" />
                  </div>
                  <div>
                    <span className="bg-emerald-500/30 text-emerald-100 text-xs font-mono px-2 py-0.5 rounded border border-emerald-400/30">
                      {selectedPengurus.id_pengurus}
                    </span>
                    <h3 className="text-xl font-bold mt-1.5 leading-tight">
                      {selectedPengurus.nama}
                    </h3>
                    <p className="text-xs text-emerald-100/80 mt-1 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> {selectedPengurus.jabatan || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 text-sm text-slate-700">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Building className="w-3 h-3" /> Cabang Majelis
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {cabangName(selectedPengurus.cabang_id)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> No. HP/WA
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {selectedPengurus.no_hp || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400">Alamat</span>
                    <p className="font-medium text-slate-800">
                      {selectedPengurus.alamat || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
