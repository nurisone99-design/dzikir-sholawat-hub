import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { GraduationCap } from "lucide-react";

export default function DataGuru() {
  return (
    <CrudPage
      title="Data Guru"
      subtitle="Kelola data guru pembimbing majelis"
      endpoint="guru"
      icon={GraduationCap}
      searchKeys={["id_guru", "nama"]}
      lookups={[{ key: "cabang_id", from: "cabang", labelKey: "kota" }]}
      filters={[{ key: "cabang_id", label: "Cabang", optionsFrom: "cabang" }]}
      columns={[
        { key: "id_guru", label: "ID Guru" },
        { key: "nama", label: "Nama Lengkap" },
        { key: "cabang_id", label: "Cabang Bimbingan" },
        { key: "jumlah_jamaah", label: "Jumlah Jamaah" },
      ]}
      fields={[
        { key: "id_guru", label: "ID Guru", type: "text", required: true },
        { key: "nama", label: "Nama Lengkap", type: "text", required: true },
        { key: "cabang_id", label: "Cabang Bimbingan", type: "select", optionsFrom: "cabang", optionLabel: "kota", required: true },
        { key: "jumlah_jamaah", label: "Jumlah Jamaah Bimbingan", type: "number" },
      ]}
    />
  );
}
