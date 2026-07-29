import React, { useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Image as ImageIcon } from "lucide-react";

export default function FileUpload({
  value,
  onChange,
  accept = "image/*",
  testid,
}) {
  const ref = useRef();

  const handle = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 4MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.readAsDataURL(file);
  };

  const isImg = value && value.startsWith("data:image");

  return (
    <div className="flex items-start gap-4">
      {/* Kotak Foto 3x4 (Tinggi sejajar Alamat, Lebar Proporsional 3x4) */}
      <div
        onClick={() => ref.current?.click()}
        className="w-36 h-[160px] rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-secondary/30 shrink-0 cursor-pointer hover:bg-secondary/50 transition-colors relative group"
      >
        {isImg ? (
          <img
            src={value}
            alt="preview"
            className="h-full w-full object-cover"
          />
        ) : value ? (
          <FileText className="h-8 w-8 text-primary" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
        )}
      </div>

      {/* Tombol Pilih File & Hapus di Sebelah Kanan Kotak Foto */}
      <div className="flex flex-col gap-2 pt-2">
        <input
          ref={ref}
          type="file"
          accept={accept}
          className="hidden"
          onChange={handle}
          data-testid={testid}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5 shrink-0"
          onClick={() => ref.current?.click()}
        >
          <Upload className="h-4 w-4" /> {value ? "Ganti File" : "Pilih File"}
        </Button>

        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl gap-1.5 text-destructive h-8 justify-start"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4" /> Hapus
          </Button>
        )}
      </div>
    </div>
  );
}
