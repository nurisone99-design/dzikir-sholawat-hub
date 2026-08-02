import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  timeout: Number(process.env.REACT_APP_API_TIMEOUT ?? 15000),
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("rj_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !err.config.url.includes("/auth/login")
    ) {
      localStorage.removeItem("rj_token");
      if (window.location.pathname.startsWith("/admin")) {
        window.location.href = "/admin/login";
      }
    }
    console.error("API Error:", err);

    return Promise.reject(err);
  },
);

export function apiError(error) {
  if (!error) {
    return "Terjadi kesalahan. Silakan coba lagi.";
  }

  // Axios timeout
  if (error.code === "ECONNABORTED") {
    return "Permintaan ke server melebihi batas waktu.";
  }

  // Tidak bisa terhubung ke server
  if (!error.response) {
    return "Tidak dapat terhubung ke server.";
  }

  const detail = error.response.data?.detail ?? error.response.data;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail.map((e) => e?.msg ?? JSON.stringify(e)).join(" ");
  }

  if (detail?.msg) return detail.msg;

  return "Terjadi kesalahan.";
}

export default api;
