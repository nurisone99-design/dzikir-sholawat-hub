import React, { useEffect, useState } from "react";
import api from "@/lib/api";
import DataTable from "@/components/admin/DataTable";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

const ACTION_COLOR = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  LOGIN: "bg-gold/20 text-gold",
  EXPORT: "bg-purple-100 text-purple-700",
};

export default function AuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/audit-logs")
      .then((r) => setRows(r.data))
      .catch((err) => {
        console.error("Gagal memuat audit log:", err);

        setRows([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-charcoal">
            Audit Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Catatan seluruh aktivitas admin dalam sistem
          </p>
        </div>
      </div>

      <DataTable
        columns={[
          {
            key: "timestamp",
            label: "Waktu",
            render: (r) => new Date(r.timestamp).toLocaleString("id-ID"),
          },
          { key: "username", label: "User" },
          {
            key: "action",
            label: "Aksi",
            render: (r) => (
              <Badge
                className={`rounded-full ${ACTION_COLOR[r.action] || "bg-secondary text-charcoal"} hover:opacity-90`}
              >
                {r.action}
              </Badge>
            ),
          },
          { key: "entity", label: "Entitas" },
          { key: "details", label: "Detail" },
        ]}
        rows={rows}
        loading={loading}
        searchKeys={["username", "action", "entity", "details"]}
        selectable={false}
        testidPrefix="audit"
      />
    </div>
  );
}
