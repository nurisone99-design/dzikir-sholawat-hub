import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { Building2 } from "lucide-react";

export default function DataCabang() {
  return (
    <CrudPage
      title="Data Cabang"
      subtitle="Kelola seluruh cabang Majelis Raudhatul Jannah"
      endpoint="cabang"
      icon={Building2}
      exportEntity="cabang"
      searchKeys={["id_cabang", "kota", "alamat", "ketua"]}
      columns={[
        { key: "id_cabang", label: "ID Cabang" },
        { key: "kota", label: "Kota" },
        { key: "alamat", label: "Alamat" },
        { key: "ketua", label: "Ketua Cabang" },
        { key: "no_hp", label: "No. HP/WA" },
      ]}
      fields={[
        { key: "id_cabang", label: "ID Cabang", type: "text", required: true },
        { key: "kota", label: "Kota Cabang", type: "text", required: true },
        { key: "alamat", label: "Alamat Lengkap", type: "textarea", required: true },
        { key: "ketua", label: "Ketua Cabang", type: "text", required: true },
        { key: "no_hp", label: "No. HP/WA Ketua", type: "text", required: true },
        { key: "lat", label: "Latitude (peta)", type: "number" },
        { key: "lng", label: "Longitude (peta)", type: "number" },
      ]}
    />
  );
}
