import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-7xl font-bold">404</h1>

        <h2 className="text-2xl font-semibold">Halaman tidak ditemukan</h2>

        <p className="text-muted-foreground">
          Halaman yang Anda cari tidak tersedia.
        </p>

        <Link
          to="/"
          className="inline-flex px-6 py-3 rounded-xl bg-primary text-primary-foreground"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
