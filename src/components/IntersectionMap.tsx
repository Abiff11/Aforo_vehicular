import { useEffect, useRef, type Dispatch } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Intersection } from '../lib/types';

const OAXACA_CENTER: L.LatLngExpression = [17.068444101520644, -96.72996727636719];

interface IntersectionMapProps {
  intersections: Intersection[];
  selectedIntersectionId: string;
  onSelect: Dispatch<string>;
}

function createMarkerIcon(intersection: Intersection, selected: boolean): L.DivIcon {
  const statusClass = intersection.verificationStatus === 'verified' ? 'verified' : 'pending';

  return L.divIcon({
    className: selected ? `numbered-map-marker ${statusClass} selected` : `numbered-map-marker ${statusClass}`,
    html: `<span aria-hidden="true">${intersection.mapNumber}</span>`,
    iconAnchor: [15, 15],
  });
}

export function IntersectionMap({ intersections, selectedIntersectionId, onSelect }: IntersectionMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const map = L.map(mapElementRef.current, {
      center: OAXACA_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const markerLayer = markerLayerRef.current;
    const map = mapRef.current;
    if (!markerLayer || !map) {
      return;
    }

    markerLayer.clearLayers();

    intersections.forEach((intersection) => {
      const selected = intersection.id === selectedIntersectionId;
      const marker = L.marker([intersection.latitude, intersection.longitude], {
        icon: createMarkerIcon(intersection, selected),
        title: `${intersection.id} ${intersection.name}`,
      });

      marker.bindTooltip(`${intersection.id} ${intersection.name}`);
      marker.on('click', () => onSelect(intersection.id));
      marker.addTo(markerLayer);
    });
  }, [intersections, onSelect, selectedIntersectionId]);

  useEffect(() => {
    mapRef.current?.invalidateSize();
  }, []);

  return (
    <section aria-label="Mapa real de intersecciones de Oaxaca" className="real-map">
      <div className="leaflet-map" ref={mapElementRef} />
    </section>
  );
}
