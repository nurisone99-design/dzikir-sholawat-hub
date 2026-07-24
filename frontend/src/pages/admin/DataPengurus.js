import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { UserCog } from "lucide-react";

export default function DataPengurus() {
  return (
    <CrudPage
      title="Data Pengurus"
      subtitle="Kelola susunan pengurus yayasan & majelis"
      endpoint="pengurus"
      icon={UserCog}
      exportEntity="pengurus"
      searchKeys={["id_pengurus", "nama", "jabatan"]}
      lookups={[{ key: "cabang_id", from: "cabang", labelKey: "kota" }]}
      filters={[{ key: "cabang_id", label: "Cabang", optionsFrom: "cabang" }]}
      columns={[
        { key: "id_pengurus", label: "ID Pengurus" },
        { key: "nama", label: "Nama Pengurus" },
        { key: "jabatan", label: "Jabatan" },
        { key: "cabang_id", label: "Cabang Majelis" },
        { key: "no_hp", label: "No. HP/WA" },
      ]}
      fields={[
        { key: "id_pengurus", label: "ID Pengurus", type: "text", required: true },
        { key: "jamaah_id", label: "Pilih dari Jamaah", type: "select", optionsFrom: "jamaah", optionLabel: "nama" },
        { key: "nama", label: "Nama Pengurus", type: "text", required: true },
        { key: "jabatan", label: "Jabatan di Yayasan", type: "text", required: true },
        { key: "cabang_id", label: "Cabang Majelis", type: "select", optionsFrom: "cabang", optionLabel: "kota", required: true },
        { key: "alamat", label: "Alamat", type: "textarea" },
        { key: "no_hp", label: "No. HP/WA", type: "text" },
      ]}
    />
  );
}
