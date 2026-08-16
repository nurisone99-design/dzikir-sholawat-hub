import { BACKEND_URL } from "@/lib/api";
import React, { useState } from "react";
import CrudPage from "@/components/admin/CrudPage";
import {
  GraduationCap,
  User,
  Phone,
  MapPin,
  Building,
  BookOpen,
  FileText,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const KITAB = [
  "Kitab Awaluddin",
  "Kitab Makam Wilayah",
  "Kitab Nun",
  "Kitab Adam Hawa",
  "Kitab Babul Hikmah",
  "Kitab Laduni Alam Barzah",
];

const AMALIAH = [
  "Amaliah Rahmatillah",
  "Amaliah Suluk",
  "Amaliah 3 Kedalam Khusus",
  "Amaliah Ramadhan",
];

const computeGuruId = (form, rows) =>
  `GUR-${String(rows.length + 1).padStart(4, "0")}`;

const fileUrl = (path) =>
  path?.startsWith("http") ? path : `${BACKEND_URL}${path}`;

export default function DataGuru() {
  const [selectedGuru, setSelectedGuru] = useState(null);

  return (
    <>
      <CrudPage
        title="Data Guru"
        subtitle="Kelola data guru pembimbing majelis"
        endpoint="guru"
        icon={GraduationCap}
        searchKeys={["id_guru", "nama", "no_hp", "cabang_nama"]}
        columns={[
          {
            key: "id_guru",
            label: "ID Guru",
            render: (r) => (
              <button
                type="button"
                onClick={() => setSelectedGuru(r)}
                className="font-mono font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
              >
                {r.id_guru}
              </button>
            ),
          },
          { key: "nama", label: "Nama Lengkap" },
          { key: "cabang_nama", label: "Cabang Bimbingan" },
          {
            key: "jumlah_jamaah",
            label: "Jml Jamaah",
            render: (r) => (
              <span className="font-semibold text-primary">
                {r.jumlah_jamaah ?? 0}
              </span>
            ),
          },
          { key: "no_hp", label: "No. HP/WA", render: (r) => r.no_hp || "-" },
        ]}
        fields={[
          {
            key: "id_guru",
            label: "ID Guru",
            type: "auto_id",
            compute: computeGuruId,
            required: true,
          },
          { key: "nama", label: "Nama Lengkap", type: "text", required: true },
          { key: "no_hp", label: "No. HP/WhatsApp", type: "text" },
          { key: "alamat", label: "Alamat Lengkap", type: "textarea" },
          {
            key: "cabang_bimbingan_group",
            label: "Cabang Bimbingan",
            type: "group",
            columns: 1,
            fields: [
              {
                key: "cabang_ids",
                label: "Cabang Bimbingan",
                type: "checkbox_group",
                optionsFrom: "cabang",
                optionLabel: "kota",
                hideLabel: true,
              },
            ],
          },
          {
            key: "ijazah_kitab_group",
            label: "Ijazah Kitab",
            type: "group",
            columns: 1,
            fields: [
              {
                key: "ijazah_kitab",
                label: "Ijazah Kitab",
                type: "checkbox_group",
                options: KITAB,
                hideLabel: true,
              },
            ],
          },
          {
            key: "ijazah_amaliah_group",
            label: "Ijazah Amaliah",
            type: "group",
            columns: 1,
            fields: [
              {
                key: "ijazah_amaliah",
                label: "Ijazah Amaliah",
                type: "checkbox_group",
                options: AMALIAH,
                hideLabel: true,
              },
            ],
          },
          {
            key: "ijazah_nama_dalam",
            label: "Ijazah Nama Dalam",
            type: "dynamic_list",
            addLabel: "Tambah Nama Dalam",
            placeholder: "Masukkan nama dalam",
          },
          {
            key: "foto_sk_group",
            label: "Foto Profil & SK Pengangkatan",
            type: "group",
            columns: 2,
            fields: [
              {
                key: "foto",
                label: "Foto Profil (3x4)",
                type: "file",
                accept: "image/*",
                aspect: "portrait",
              },
              {
                key: "sk",
                label: "SK Pengangkatan",
                type: "file",
                accept: "image/*,application/pdf",
                aspect: "landscape",
              },
            ],
          },
        ]}
      />

      {/* Pop-up Kartu Detail Guru */}
      <Dialog open={!!selectedGuru} onOpenChange={() => setSelectedGuru(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <DialogTitle className="sr-only">Detail Guru</DialogTitle>
          <DialogDescription className="sr-only">
            Kartu informasi lengkap guru pembimbing.
          </DialogDescription>
          {selectedGuru && (
            <div className="bg-white">
              <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 text-white relative">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-28 bg-emerald-900/40 rounded-lg border-2 border-emerald-200/50 overflow-hidden flex-shrink-0 shadow-md flex items-center justify-center">
                    {selectedGuru.foto ? (
                      <img
                        src={fileUrl(selectedGuru.foto)}
                        alt={selectedGuru.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-emerald-200/60" />
                    )}
                  </div>
                  <div>
                    <span className="bg-emerald-500/30 text-emerald-100 text-xs font-mono px-2 py-0.5 rounded border border-emerald-400/30">
                      {selectedGuru.id_guru}
                    </span>
                    <h3 className="text-xl font-bold mt-1.5 leading-tight">
                      {selectedGuru.nama}
                    </h3>
                    <p className="text-xs text-emerald-100/80 mt-1">
                      {selectedGuru.no_hp || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4 text-sm text-slate-700 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Building className="w-3 h-3" /> Cabang Bimbingan
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {selectedGuru.cabang_nama || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> No. HP/WA
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {selectedGuru.no_hp || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-slate-400">
                      Alamat Lengkap
                    </span>
                    <p className="font-medium text-slate-800">
                      {selectedGuru.alamat || "-"}
                    </p>
                  </div>
                </div>

                {selectedGuru.sk && (
                  <a
                    href={fileUrl(selectedGuru.sk)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-emerald-700 hover:underline"
                  >
                    <FileText className="w-4 h-4" /> Lihat SK Pengangkatan
                  </a>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Ijazah
                    Spiritual
                  </span>

                  <div className="space-y-3 text-xs">
                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Kitab:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedGuru.ijazah_kitab) &&
                        selectedGuru.ijazah_kitab.length > 0 ? (
                          selectedGuru.ijazah_kitab.map((k) => (
                            <Badge
                              key={k}
                              variant="secondary"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              {k}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Amaliah:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedGuru.ijazah_amaliah) &&
                        selectedGuru.ijazah_amaliah.length > 0 ? (
                          selectedGuru.ijazah_amaliah.map((a) => (
                            <Badge
                              key={a}
                              variant="secondary"
                              className="text-[10px] bg-teal-50 text-teal-700 border-teal-200"
                            >
                              {a}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Nama Dalam:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedGuru.ijazah_nama_dalam) &&
                        selectedGuru.ijazah_nama_dalam.length > 0 ? (
                          selectedGuru.ijazah_nama_dalam.map((nd, idx) => (
                            <Badge
                              key={idx}
                              variant="secondary"
                              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              {nd}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </div>
                    </div>
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
