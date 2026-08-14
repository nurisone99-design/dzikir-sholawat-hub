import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

const icon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function ClickHandler({ onChange }) {
  useMapEvents({ click(e) { onChange({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

// Memindahkan viewport peta mengikuti koordinat terbaru (mis. hasil geocoding),
// tanpa perlu remount MapContainer.
function Recenter({ lat, lng, hasPos }) {
  const map = useMap();
  useEffect(() => {
    if (hasPos) {
      map.setView([lat, lng], Math.max(map.getZoom(), 12));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, hasPos]);
  return null;
}

export default function MapPicker({ value, onChange, address }) {
  const [ready, setReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const didMountRef = useRef(false);
  const prevAddressRef = useRef(address);

  useEffect(() => { setReady(true); }, []);

  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const hasPos = !Number.isNaN(lat) && !Number.isNaN(lng) && value?.lat !== "" && value?.lng !== "";
  const center = hasPos ? [lat, lng] : [-2.5, 118];

  // Geocoding otomatis saat alamat diisi/diubah. Dilewati saat mount pertama
  // agar koordinat yang sudah tersimpan di database (mode Edit) tidak
  // di-geocode ulang hanya karena form dibuka.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      prevAddressRef.current = address;
      return;
    }
    if (!address || !address.trim() || address === prevAddressRef.current) return;

    const handle = setTimeout(async () => {
      prevAddressRef.current = address;
      setGeocoding(true);
      setGeocodeFailed(false);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`,
        );
        const data = await res.json();
        if (data && data[0]) {
          onChange({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        } else {
          setGeocodeFailed(true);
        }
      } catch (err) {
        console.error("Gagal melakukan geocoding alamat:", err);
        setGeocodeFailed(true);
      } finally {
        setGeocoding(false);
      }
    }, 900);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <div className="space-y-2" data-testid="cabang-map-picker">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
        {ready && (
          <MapContainer center={center} zoom={hasPos ? 12 : 4} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickHandler onChange={onChange} />
            <Recenter lat={lat} lng={lng} hasPos={hasPos} />
            {hasPos && (
              <Marker
                position={[lat, lng]}
                icon={icon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    onChange({ lat: pos.lat, lng: pos.lng });
                  },
                }}
              />
            )}
          </MapContainer>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Lokasi otomatis mengikuti alamat. Geser titik pada peta untuk menyesuaikan posisi yang tepat.
        {geocoding && <span className="text-primary font-medium"> Mencari lokasi…</span>}
        {hasPos && !geocoding && (
          <span className="text-primary font-medium"> Koordinat: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
        )}
      </p>
      {geocodeFailed && (
        <p className="text-xs text-destructive">
          Lokasi untuk alamat ini tidak ditemukan otomatis. Klik atau geser marker pada peta untuk menentukan posisi secara manual.
        </p>
      )}
    </div>
  );
}
