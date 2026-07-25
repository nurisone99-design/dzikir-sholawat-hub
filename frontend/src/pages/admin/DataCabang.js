import React from "react";
import CrudPage from "@/components/admin/CrudPage";
import { Building2 } from "lucide-react";

// Auto ID Cabang: prefix dari Guru Pembimbing, mis. G01-CB-01
const computeCabangId = (form, rows, raw) => {
  const guru = (raw.guru_id || []).find((g) => g.id === form.guru_id);
  if (!guru) return "";
  const gd = String(guru.id_guru || "").replace(/\D/g, "").slice(-2) || "00";
  const code = `G${gd.padStart(2, "0")}`;
  const seq = rows.filter((c) => c.guru_id === form.guru_id).length + 1;
  return `${code}-CB-${String(seq).padStart(2, "0")}`;
};

export default function DataCabang() {
  return (
    <CrudPage
      title="Data Cabang"
      subtitle="Kelola seluruh cabang Majelis Raudhatul Jannah"
      endpoint="cabang"
      icon={Building2}
      exportEntity="cabang"
      searchKeys={["id_cabang", "kota", "alamat", "ketua"]}
      lookups={[{ key: "guru_id", from: "guru", labelKey: "nama" }]}
      columns={[
        { key: "id_cabang", label: "ID Cabang" },
        { key: "kota", label: "Kota" },
        { key: "guru_id", label: "Guru Pembimbing" },
        { key: "ketua", label: "Ketua Cabang" },
        { key: "no_hp", label: "No. HP/WA" },
        { key: "alamat", label: "Alamat", sortable: false, render: (r) => <span className="block max-w-[240px] truncate" title={r.alamat}>{r.alamat}</span> },
      ]}
      fields={[
        { key: "guru_id", label: "Guru Pembimbing", type: "select", optionsFrom: "guru", optionLabel: "nama", required: true },
        { key: "id_cabang", label: "ID Cabang", type: "auto_id", compute: computeCabangId, required: true },
        { key: "kota", label: "Kota Cabang", type: "text", required: true },
        { key: "ketua", label: "Ketua Cabang", type: "text", required: true },
        { key: "no_hp", label: "No. HP/WA Ketua", type: "text", required: true },
        { key: "alamat", label: "Alamat Lengkap", type: "textarea", required: true },
        { key: "lokasi", label: "Titik Lokasi di Peta", type: "map", latKey: "lat", lngKey: "lng" },
      ]}
    />
  );
}
