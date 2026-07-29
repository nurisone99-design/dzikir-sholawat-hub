import React, { useState, useEffect } from "react";
import CrudPage from "@/components/admin/CrudPage";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  User,
  Phone,
  MapPin,
  Calendar,
  Building,
  BookOpen,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import api from "@/lib/api";

const KITAB = [
  "Kitab Awwaluddin",
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

// Helper format tanggal untuk Kartu Jamaah (misal: 14 November 1987)
const formatTanggalIndo = (dateString) => {
  if (!dateString) return "-";

  const cleanStr = String(dateString).trim();
  if (
    cleanStr.includes("/") ||
    (cleanStr.includes("-") && cleanStr.split("-")[0].length < 4)
  ) {
    const separator = cleanStr.includes("/") ? "/" : "-";
    const parts = cleanStr.split(separator);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const monthIndex = parseInt(parts[1], 10) - 1;
      const year = parts[2];
      const bulanIndo = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      if (!isNaN(day) && monthIndex >= 0 && monthIndex < 12) {
        return `${day} ${bulanIndo[monthIndex]} ${year}`;
      }
    }
  }

  const dateObj = new Date(cleanStr);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  return cleanStr;
};

export default function DataJamaah() {
  const [selectedJamaah, setSelectedJamaah] = useState(null);
  const [cabangOptions, setCabangOptions] = useState([]);

  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const res = await api.get("/cabang");
        const list = res.data?.data || res.data || [];
        const formatted = list.map((c) => ({
          value: c._id || c.id || c.id_cabang,
          label:
            c.kota ||
            c.nama ||
            c.nama_cabang ||
            c.cabang ||
            "Cabang Tanpa Nama",
        }));
        setCabangOptions(formatted);
      } catch (err) {
        console.error("Gagal memuat list cabang:", err);
      }
    };
    fetchCabang();
  }, []);

  const formatJamaahId = (r) => {
    if (
      r.id_jamaah &&
      !r.id_jamaah.includes("JAM-") &&
      r.id_jamaah.length > 20
    ) {
      const rawCabang = String(r.id_cabang || r.cabang_id || r.cabang || "000");
      const last3Cabang = rawCabang.slice(-3).toUpperCase();
      const num = String(r.no_urut || r.index || 1).padStart(5, "0");
      return `${last3Cabang}-${num}`;
    }

    if (r.id_jamaah) {
      const rawCabang = String(r.id_cabang || r.cabang_id || r.cabang || "000");
      const last3Cabang = rawCabang.slice(-3).toUpperCase();
      const cleanNum = String(r.id_jamaah).replace(/[^0-9]/g, "");
      const num = cleanNum ? cleanNum.padStart(5, "0") : "00001";
      return `${last3Cabang}-${num}`;
    }

    return "000-00001";
  };

  const getCabangName = (r) => {
    if (r.cabang_nama) return r.cabang_nama;
    if (r.nama_cabang) return r.nama_cabang;
    if (r.kota) return r.kota;
    if (typeof r.cabang === "string" && r.cabang.length < 20) return r.cabang;
    if (typeof r.id_cabang === "string" && r.id_cabang.length < 20)
      return r.id_cabang;
    if (r.cabang?.nama) return r.cabang.nama;
    if (r.cabang?.kota) return r.cabang.kota;

    const found = cabangOptions.find(
      (c) => c.value === (r.id_cabang || r.cabang_id),
    );
    if (found) return found.label;

    return "Pusat / Utama";
  };

  const columns = [
    {
      key: "id_jamaah",
      label: "ID Jamaah",
      render: (r) => (
        <button
          type="button"
          onClick={() => setSelectedJamaah(r)}
          className="font-mono font-semibold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer flex items-center gap-1.5"
        >
          {formatJamaahId(r)}
        </button>
      ),
    },
    { key: "nama", label: "Nama Lengkap" },
    { key: "gender", label: "Gender" },
    {
      key: "alamat",
      label: "Alamat",
      sortable: false,
      render: (r) => (
        <span className="block max-w-[300px] truncate" title={r.alamat}>
          {r.alamat || "-"}
        </span>
      ),
    },
  ];

  const fields = [
    { key: "nama", label: "Nama Lengkap", required: true },
    { key: "nik", label: "No. KTP/NIK" },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      required: true,
      options: [
        { value: "Laki-laki", label: "Laki-laki" },
        { value: "Perempuan", label: "Perempuan" },
      ],
    },
    { key: "no_hp", label: "No. HP/Whatsapp" },
    { key: "tempat_lahir", label: "Tempat Lahir" },
    {
      key: "tanggal_lahir",
      label: "Tanggal Lahir",
      type: "date",
      lang: "id-ID",
      inputProps: {
        lang: "id-ID",
      },
    },
    {
      key: "id_cabang",
      label: "Cabang",
      type: "select",
      required: true,
      options: cabangOptions,
    },
    { key: "nama_orang_tua", label: "Nama Orang Tua" },
    { key: "alamat", label: "Alamat", type: "textarea" },
    {
      key: "foto",
      label: "Foto Pas 3x4",
      type: "file",
      accept: "image/*",
      aspect: "3/4",
    },
    {
      key: "ijazah_kitab",
      label: "Ijazah Kitab",
      type: "tags",
      tagOptions: KITAB,
      full: true,
    },
    {
      key: "ijazah_amaliah",
      label: "Ijazah Amaliah",
      type: "tags",
      tagOptions: AMALIAH,
      full: true,
    },
    {
      key: "ijazah_nama_dalam",
      label: "Ijazah Nama Dalam",
      type: "dynamic_list",
      addLabel: "Tambah Nama Dalam",
      placeholder: "Masukkan nama dalam",
      full: true,
    },
  ];

  return (
    <>
      <CrudPage
        title="Data Jamaah"
        subtitle="Kelola data jamaah beserta pelacakan ijazah spiritual"
        endpoint="jamaah"
        icon={Users}
        exportEntity="jamaah"
        searchKeys={[
          "id_jamaah",
          "nama",
          "nik",
          "alamat",
          "nama_orang_tua",
          "tempat_lahir",
        ]}
        lookups={[{ key: "id_cabang", from: "cabang", labelKey: "kota" }]}
        filters={[
          { key: "id_cabang", label: "Cabang", options: cabangOptions },
          {
            key: "gender",
            label: "Gender",
            options: [
              { value: "Laki-laki", label: "Laki-laki" },
              { value: "Perempuan", label: "Perempuan" },
            ],
          },
        ]}
        columns={columns}
        fields={fields}
      />

      {/* Pop-up Kartu Detail Jamaah */}
      <Dialog
        open={!!selectedJamaah}
        onOpenChange={() => setSelectedJamaah(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          {selectedJamaah && (
            <div className="bg-white">
              {/* Header Kartu */}
              <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 text-white relative">
                <div className="flex items-center gap-4">
                  {/* Frame Foto 3x4 */}
                  <div className="w-20 h-28 bg-emerald-900/40 rounded-lg border-2 border-emerald-200/50 overflow-hidden flex-shrink-0 shadow-md flex items-center justify-center">
                    {selectedJamaah.foto ? (
                      <img
                        src={selectedJamaah.foto}
                        alt={selectedJamaah.nama}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-emerald-200/60" />
                    )}
                  </div>

                  {/* Ringkasan Nama & ID */}
                  <div>
                    <span className="bg-emerald-500/30 text-emerald-100 text-xs font-mono px-2 py-0.5 rounded border border-emerald-400/30">
                      {formatJamaahId(selectedJamaah)}
                    </span>
                    <h3 className="text-xl font-bold mt-1.5 leading-tight">
                      {selectedJamaah.nama}
                    </h3>
                    <p className="text-xs text-emerald-100/80 mt-1">
                      NIK: {selectedJamaah.nik || "-"}
                    </p>
                    <Badge className="mt-2 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30 text-[10px] border-emerald-300/30">
                      {selectedJamaah.gender || "Laki-laki"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Body Kartu Info */}
              <div className="p-6 space-y-4 text-sm text-slate-700 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Building className="w-3 h-3" /> Cabang
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {getCabangName(selectedJamaah)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                      <Phone className="w-3 h-3" /> No. HP/WA
                    </span>
                    <p className="font-semibold mt-0.5 text-slate-800">
                      {selectedJamaah.no_hp || "-"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400">
                        Tempat, Tanggal Lahir
                      </span>
                      <p className="font-medium text-slate-800">
                        {selectedJamaah.tempat_lahir || "-"},{" "}
                        {formatTanggalIndo(selectedJamaah.tanggal_lahir)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-slate-400">
                        Nama Orang Tua
                      </span>
                      <p className="font-medium text-slate-800">
                        {selectedJamaah.nama_orang_tua ||
                          selectedJamaah.nama_ortu ||
                          "-"}
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
                        {selectedJamaah.alamat || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bagian Ijazah Spiritual */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Track
                    Ijazah Spiritual
                  </span>

                  <div className="space-y-3 text-xs">
                    {/* Ijazah Kitab */}
                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Kitab:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedJamaah.ijazah_kitab) &&
                        selectedJamaah.ijazah_kitab.length > 0 ? (
                          selectedJamaah.ijazah_kitab.map((k) => (
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

                    {/* Ijazah Amaliah */}
                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Amaliah:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedJamaah.ijazah_amaliah) &&
                        selectedJamaah.ijazah_amaliah.length > 0 ? (
                          selectedJamaah.ijazah_amaliah.map((a) => (
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

                    {/* Ijazah Nama Dalam */}
                    <div>
                      <p className="text-slate-400 mb-1 font-medium">
                        Ijazah Nama Dalam:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(selectedJamaah.ijazah_nama_dalam) &&
                        selectedJamaah.ijazah_nama_dalam.length > 0 ? (
                          selectedJamaah.ijazah_nama_dalam.map((nd, idx) => (
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
