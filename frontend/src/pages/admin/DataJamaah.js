import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const KITAB = ["Kitab Ratib Al-Haddad", "Kitab Dalail Khairat", "Kitab Simtud Duror", "Kitab Maulid Barzanji"];
const AMALIAH = ["Amaliah Istighosah", "Amaliah Sholawat Nariyah", "Amaliah Dzikir Asma", "Amaliah Ratib"];

const tagCell = (arr) => (
  <div className="flex flex-wrap gap-1 max-w-xs">
    {(arr || []).slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="rounded-full text-[10px]">{t}</Badge>)}
    {(arr || []).length > 2 && <Badge variant="outline" className="rounded-full text-[10px]">+{arr.length - 2}</Badge>}
    {(arr || []).length === 0 && <span className="text-muted-foreground text-xs">-</span>}
  </div>
);

// Auto-generate ID Jamaah: {BR + kode cabang}-{L/P}-{urutan}, e.g. BR01-L-0001
const computeJamaahId = (form, rows, raw) => {
  const cabangList = raw.cabang_id || [];
  const cabang = cabangList.find((c) => c.id === form.cabang_id);
  if (!cabang || !form.gender) return "";
  const digits = String(cabang.id_cabang || "").replace(/\D/g, "").slice(-2) || "00";
  const code = `BR${digits.padStart(2, "0")}`;
  const g = form.gender === "Laki-laki" ? "L" : "P";
  const seq = rows.filter((r) => r.cabang_id === form.cabang_id && r.gender === form.gender).length + 1;
  return `${code}-${g}-${String(seq).padStart(4, "0")}`;
};

export default function DataJamaah() {
  return (
    <CrudPage
      title="Data Jamaah"
      subtitle="Kelola data jamaah beserta pelacakan ijazah spiritual"
      endpoint="jamaah"
      icon={Users}
      exportEntity="jamaah"
      searchKeys={["id_jamaah", "nama", "nik", "alamat", "nama_ortu", "tempat_lahir"]}
      lookups={[{ key: "cabang_id", from: "cabang", labelKey: "kota" }]}
      filters={[
        { key: "cabang_id", label: "Cabang", optionsFrom: "cabang" },
        { key: "gender", label: "Gender", options: [
          { value: "Laki-laki", label: "Laki-laki" }, { value: "Perempuan", label: "Perempuan" },
        ] },
      ]}
      columns={[
        { key: "id_jamaah", label: "ID Jamaah" },
        { key: "nama", label: "Nama Lengkap" },
        { key: "nik", label: "No. KTP/NIK", render: (r) => r.nik || "-" },
        { key: "gender", label: "Gender" },
        { key: "cabang_id", label: "Cabang" },
        { key: "tempat_lahir", label: "Tempat Lahir", render: (r) => r.tempat_lahir || "-" },
        { key: "tanggal_lahir", label: "Tanggal Lahir", render: (r) => r.tanggal_lahir ? new Date(r.tanggal_lahir).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-" },
        { key: "nama_ortu", label: "Nama Orang Tua", render: (r) => r.nama_ortu || "-" },
        { key: "alamat", label: "Alamat", sortable: false, render: (r) => <span className="block max-w-[220px] truncate" title={r.alamat}>{r.alamat || "-"}</span> },
        { key: "ijazah_kitab", label: "Ijazah Kitab", sortable: false, render: (r) => tagCell(r.ijazah_kitab) },
        { key: "ijazah_amaliah", label: "Ijazah Amaliah", sortable: false, render: (r) => tagCell(r.ijazah_amaliah) },
        { key: "ijazah_nama_dalam", label: "Ijazah Nama Dalam", sortable: false, render: (r) => tagCell(r.ijazah_nama_dalam) },
      ]}
      fields={[
        { key: "cabang_id", label: "Cabang", type: "select", optionsFrom: "cabang", optionLabel: "kota", required: true },
        { key: "gender", label: "Gender", type: "select", options: [
          { value: "Laki-laki", label: "Laki-laki" }, { value: "Perempuan", label: "Perempuan" },
        ], required: true },
        { key: "id_jamaah", label: "ID Jamaah", type: "auto_id", compute: computeJamaahId, required: true },
        { key: "nama", label: "Nama Lengkap", type: "text", required: true },
        { key: "nik", label: "No. KTP/NIK", type: "text" },
        { key: "tempat_lahir", label: "Tempat Lahir", type: "text" },
        { key: "tanggal_lahir", label: "Tanggal Lahir", type: "date" },
        { key: "nama_ortu", label: "Nama Orang Tua", type: "text" },
        { key: "alamat", label: "Alamat", type: "textarea" },
        { key: "ijazah_kitab", label: "Ijazah Kitab", type: "tags", tagOptions: KITAB },
        { key: "ijazah_amaliah", label: "Ijazah Amaliah", type: "tags", tagOptions: AMALIAH },
        { key: "ijazah_nama_dalam", label: "Ijazah Nama Dalam", type: "dynamic_list", addLabel: "Tambah Nama Dalam", placeholder: "Masukkan nama dalam" },
      ]}
    />
  );
}
