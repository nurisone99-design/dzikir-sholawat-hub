import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

const KITAB = ["Kitab Ratib Al-Haddad", "Kitab Dalail Khairat", "Kitab Simtud Duror", "Kitab Maulid Barzanji"];
const AMALIAH = ["Amaliah Istighosah", "Amaliah Sholawat Nariyah", "Amaliah Dzikir Asma", "Amaliah Ratib"];
const NAMA_DALAM = ["Nama Dalam 1 - Nurul Iman", "Nama Dalam 2 - Ma'rifatullah", "Nama Dalam 3 - Nurul Islam"];

const tagCell = (arr) => (
  <div className="flex flex-wrap gap-1 max-w-xs">
    {(arr || []).slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="rounded-full text-[10px]">{t}</Badge>)}
    {(arr || []).length > 2 && <Badge variant="outline" className="rounded-full text-[10px]">+{arr.length - 2}</Badge>}
    {(arr || []).length === 0 && <span className="text-muted-foreground text-xs">-</span>}
  </div>
);

export default function DataJamaah() {
  return (
    <CrudPage
      title="Data Jamaah"
      subtitle="Kelola data jamaah beserta pelacakan ijazah spiritual"
      endpoint="jamaah"
      icon={Users}
      exportEntity="jamaah"
      searchKeys={["id_jamaah", "nama", "nik", "alamat"]}
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
        { key: "gender", label: "Gender" },
        { key: "cabang_id", label: "Cabang" },
        { key: "ijazah_kitab", label: "Ijazah Kitab", sortable: false, render: (r) => tagCell(r.ijazah_kitab) },
        { key: "ijazah_amaliah", label: "Ijazah Amaliah", sortable: false, render: (r) => tagCell(r.ijazah_amaliah) },
      ]}
      fields={[
        { key: "id_jamaah", label: "ID Jamaah", type: "text", required: true },
        { key: "nama", label: "Nama Lengkap", type: "text", required: true },
        { key: "nik", label: "No. KTP/NIK", type: "text" },
        { key: "gender", label: "Gender", type: "select", options: [
          { value: "Laki-laki", label: "Laki-laki" }, { value: "Perempuan", label: "Perempuan" },
        ], required: true },
        { key: "tempat_lahir", label: "Tempat Lahir", type: "text" },
        { key: "tanggal_lahir", label: "Tanggal Lahir", type: "date" },
        { key: "nama_ortu", label: "Nama Orang Tua", type: "text" },
        { key: "cabang_id", label: "Cabang", type: "select", optionsFrom: "cabang", optionLabel: "kota", required: true },
        { key: "alamat", label: "Alamat", type: "textarea" },
        { key: "ijazah_kitab", label: "Ijazah Kitab", type: "tags", tagOptions: KITAB },
        { key: "ijazah_amaliah", label: "Ijazah Amaliah", type: "tags", tagOptions: AMALIAH },
        { key: "ijazah_nama_dalam", label: "Ijazah Nama Dalam", type: "tags", tagOptions: NAMA_DALAM },
      ]}
    />
  );
}
