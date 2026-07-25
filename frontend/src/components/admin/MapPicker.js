import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

export default function MapPicker({ value, onChange }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  const hasPos = !Number.isNaN(lat) && !Number.isNaN(lng) && value?.lat !== "" && value?.lng !== "";
  const center = hasPos ? [lat, lng] : [-2.5, 118];

  return (
    <div className="space-y-2" data-testid="cabang-map-picker">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 280 }}>
        {ready && (
          <MapContainer center={center} zoom={hasPos ? 12 : 4} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickHandler onChange={onChange} />
            {hasPos && <Marker position={[lat, lng]} icon={icon} />}
          </MapContainer>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Klik pada peta untuk menentukan lokasi cabang.
        {hasPos && <span className="text-primary font-medium"> Koordinat: {lat.toFixed(5)}, {lng.toFixed(5)}</span>}
      </p>
    </div>
  );
}
