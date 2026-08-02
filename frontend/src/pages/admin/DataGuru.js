import { BACKEND_URL } from "@/lib/api";
import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { GraduationCap } from "lucide-react";

const KITAB = [
  "Kitab Ratib Al-Haddad",
  "Kitab Dalail Khairat",
  "Kitab Simtud Duror",
  "Kitab Maulid Barzanji",
];
const AMALIAH = [
  "Amaliah Istighosah",
  "Amaliah Sholawat Nariyah",
  "Amaliah Dzikir Asma",
  "Amaliah Ratib",
];

const computeGuruId = (form, rows) =>
  `GUR-${String(rows.length + 1).padStart(4, "0")}`;

export default function DataGuru() {
  return (
    <CrudPage
      title="Data Guru"
      subtitle="Kelola data guru pembimbing majelis"
      endpoint="guru"
      icon={GraduationCap}
      searchKeys={["id_guru", "nama", "no_hp", "cabang_nama"]}
      columns={[
        { key: "id_guru", label: "ID Guru" },
        {
          key: "foto",
          label: "Foto",
          sortable: false,
          render: (r) => {
            if (!r.foto) {
              return <span className="text-muted-foreground text-xs">-</span>;
            }

            const src = r.foto.startsWith("http")
              ? r.foto
              : `${BACKEND_URL}${r.foto}`;

            return (
              <img
                src={src}
                alt={r.nama}
                className="h-11 w-9 rounded-lg object-cover border border-border"
              />
            );
          },
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
          key: "cabang_ids",
          label: "Cabang Bimbingan",
          type: "checkbox_group",
          optionsFrom: "cabang",
          optionLabel: "kota",
        },
        {
          key: "ijazah_kitab",
          label: "Ijazah Kitab",
          type: "checkbox_group",
          options: KITAB,
        },
        {
          key: "ijazah_amaliah",
          label: "Ijazah Amaliah",
          type: "checkbox_group",
          options: AMALIAH,
        },
        {
          key: "ijazah_nama_dalam",
          label: "Ijazah Nama Dalam",
          type: "dynamic_list",
          addLabel: "Tambah Nama Dalam",
          placeholder: "Masukkan nama dalam",
        },
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
      ]}
    />
  );
}
