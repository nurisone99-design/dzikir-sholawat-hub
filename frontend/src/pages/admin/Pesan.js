import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Trash2, MessageCircle, Clock } from "lucide-react";

export default function Pesan() {
  const { isViewer } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get("/messages"); setRows(data); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => {
    try { await api.delete(`/messages/${id}`); toast.success("Pesan dihapus"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center"><MessageSquare className="h-5 w-5 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold font-display text-charcoal">Pesan Masuk</h1>
          <p className="text-sm text-muted-foreground">Pesan dari formulir kontak situs publik</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {rows.map((m) => (
            <div key={m.id} className="premium-card p-6" data-testid="pesan-item">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-charcoal">{m.nama}</p>
                  <p className="text-sm text-primary">{m.whatsapp}</p>
                </div>
                {!isViewer && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => del(m.id)} data-testid="pesan-delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{m.pesan}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {new Date(m.created_at).toLocaleString("id-ID")}
                </span>
                <a href={`https://wa.me/${String(m.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="rounded-lg gap-1.5 h-8">
                    <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> Balas
                  </Button>
                </a>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-muted-foreground col-span-full">Belum ada pesan masuk.</p>}
        </div>
      )}
    </div>
  );
}
