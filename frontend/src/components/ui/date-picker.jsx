import * as React from "react";
import { parse, format, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}) {
  const dateInputRef = React.useRef(null);
  const [displayValue, setDisplayValue] = React.useState("");

  // Sync value dari parent (format "YYYY-MM-DD") ke teks tampilan ("DD/MM/YYYY")
  React.useEffect(() => {
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const [yyyy, mm, dd] = parts;
        setDisplayValue(`${dd}/${mm}/${yyyy}`);
        return;
      }
    }
    setDisplayValue("");
  }, [value]);

  // Handler saat user mengetik manual (Auto-format garis miring /)
  const handleTextChange = (e) => {
    let input = e.target.value.replace(/\D/g, ""); // Ambil angka saja

    if (input.length > 8) input = input.slice(0, 8);

    // Format visual menjadi DD/MM/YYYY
    let formatted = input;
    if (input.length > 2 && input.length <= 4) {
      formatted = `${input.slice(0, 2)}/${input.slice(2)}`;
    } else if (input.length > 4) {
      formatted = `${input.slice(0, 2)}/${input.slice(2, 4)}/${input.slice(4)}`;
    }

    setDisplayValue(formatted);

    // Jika sudah lengkap 10 karakter (DD/MM/YYYY), validasi dan kirim ke parent ("YYYY-MM-DD")
    if (formatted.length === 10) {
      const parsedDate = parse(formatted, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        const isoDate = format(parsedDate, "yyyy-MM-dd");
        onChange?.(isoDate);
      }
    } else if (formatted === "") {
      onChange?.("");
    }
  };

  // Handler jika tanggal dipilih via popup kalender
  const handleCalendarChange = (e) => {
    const selectedDate = e.target.value; // Format "YYYY-MM-DD"
    onChange?.(selectedDate);
  };

  // Fungsi saat ikon kalender diklik
  const openCalendar = () => {
    if (dateInputRef.current) {
      try {
        if ("showPicker" in HTMLInputElement.prototype) {
          dateInputRef.current.showPicker();
        } else {
          dateInputRef.current.focus();
        }
      } catch (err) {
        dateInputRef.current.focus();
      }
    }
  };

  return (
    <div className="relative w-full flex items-center">
      {/* Input Teks untuk Ketik Manual */}
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        maxLength={10}
        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Tombol Ikon Kalender di Sebelah Kanan */}
      <button
        type="button"
        onClick={openCalendar}
        className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        tabIndex={-1}
      >
        <CalendarIcon className="h-4 w-4 opacity-70 hover:opacity-100" />
      </button>

      {/* Input Date Tersembunyi (Hanya dipanggil via Ikon) */}
      <input
        ref={dateInputRef}
        type="date"
        value={value || ""}
        onChange={handleCalendarChange}
        className="sr-only"
      />
    </div>
  );
}
