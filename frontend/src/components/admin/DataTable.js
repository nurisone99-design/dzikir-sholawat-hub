import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, FileText,
  Pencil, Trash2, ChevronLeft, ChevronRight, Inbox,
} from "lucide-react";

const PAGE_SIZE = 8;

export default function DataTable({
  columns, rows, loading, searchKeys = [], filters = [],
  onEdit, onDelete, onBulkDelete, onExport, canWrite = true, canWriteRow,
  selectable = true, testidPrefix = "table",
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [filterVals, setFilterVals] = useState({});

  const filtered = useMemo(() => {
    let data = [...rows];
    if (q.trim()) {
      const s = q.toLowerCase();
      data = data.filter((r) =>
        searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s))
      );
    }
    filters.forEach((f) => {
      const v = filterVals[f.key];
      if (v && v !== "__all__") data = data.filter((r) => String(r[f.key]) === v);
    });
    if (sort.key) {
      data.sort((a, b) => {
        const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
        return String(av).localeCompare(String(bv)) * sort.dir;
      });
    }
    return data;
  }, [rows, q, sort, filterVals, searchKeys, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  const writablePageRows = canWriteRow ? pageRows.filter(canWriteRow) : pageRows;
  const allChecked = writablePageRows.length > 0 && writablePageRows.every((r) => selected.includes(r.id));
  const toggleAll = () =>
    setSelected(allChecked
      ? selected.filter((id) => !writablePageRows.some((r) => r.id === id))
      : [...new Set([...selected, ...writablePageRows.map((r) => r.id)])]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid={`${testidPrefix}-search`}
            placeholder="Cari data..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <Select key={f.key}
              value={filterVals[f.key] || "__all__"}
              onValueChange={(v) => { setFilterVals((p) => ({ ...p, [f.key]: v })); setPage(1); }}>
              <SelectTrigger className="w-[160px] rounded-xl" data-testid={`${testidPrefix}-filter-${f.key}`}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Semua {f.label}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {onExport && (
            <>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
                onClick={() => onExport("xlsx")} data-testid={`${testidPrefix}-export-excel`}>
                <FileSpreadsheet className="h-4 w-4 text-emerald-brand" /> Excel
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl gap-1.5"
                onClick={() => onExport("pdf")} data-testid={`${testidPrefix}-export-pdf`}>
                <FileText className="h-4 w-4 text-gold" /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {selectable && selected.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-2.5">
          <span className="text-sm font-medium">{selected.length} dipilih</span>
          {onBulkDelete && canWrite && (
            <Button size="sm" variant="destructive" className="rounded-lg"
              onClick={() => { onBulkDelete(selected); setSelected([]); }}
              data-testid={`${testidPrefix}-bulk-delete`}>
              <Trash2 className="h-4 w-4 mr-1" /> Hapus Terpilih
            </Button>
          )}
        </div>
      )}

      <div className="premium-card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                {selectable && (
                  <TableHead className="w-10 sticky top-0">
                    {(!canWriteRow || writablePageRows.length > 0) && (
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll}
                        data-testid={`${testidPrefix}-check-all`} />
                    )}
                  </TableHead>
                )}
                {columns.map((c) => (
                  <TableHead key={c.key}
                    className="font-semibold text-charcoal whitespace-nowrap cursor-pointer select-none"
                    onClick={() => c.sortable !== false && toggleSort(c.key)}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.sortable !== false && (
                        sort.key === c.key
                          ? (sort.dir === 1 ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />)
                          : <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
                      )}
                    </span>
                  </TableHead>
                ))}
                {(onEdit || onDelete) && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={columns.length + 2}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="h-10 w-10 opacity-40" />
                      <p>Tidak ada data</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow key={r.id} data-testid={`${testidPrefix}-row`}>
                    {selectable && (
                      <TableCell>
                        {(!canWriteRow || canWriteRow(r)) && (
                          <Checkbox checked={selected.includes(r.id)}
                            onCheckedChange={() =>
                              setSelected((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} />
                        )}
                      </TableCell>
                    )}
                    {columns.map((c) => (
                      <TableCell key={c.key} className="whitespace-nowrap">
                        {c.render ? c.render(r) : (r[c.key] ?? "-")}
                      </TableCell>
                    ))}
                    {(onEdit || onDelete) && (
                      <TableCell className="text-right whitespace-nowrap">
                        {onEdit && canWrite && (!canWriteRow || canWriteRow(r)) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => onEdit(r)} data-testid={`${testidPrefix}-edit`}>
                            <Pencil className="h-4 w-4 text-emerald-brand" />
                          </Button>
                        )}
                        {onDelete && canWrite && (!canWriteRow || canWriteRow(r)) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => onDelete(r)} data-testid={`${testidPrefix}-delete`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Menampilkan {pageRows.length} dari {filtered.length} data</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
            disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            data-testid={`${testidPrefix}-prev`}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium text-charcoal">{page} / {totalPages}</span>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
            disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            data-testid={`${testidPrefix}-next`}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
