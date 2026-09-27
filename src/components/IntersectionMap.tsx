import { useEffect, useRef, type Dispatch } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Intersection } from '../lib/types';

const OAXACA_CENTER: L.LatLngExpression = [17.068444101520644, -96.72996727636719];
const OAXACA_CENTER_POINT = { latitude: 17.068444101520644, longitude: -96.72996727636719 };

interface IntersectionMapProps {
  intersections: Intersection[];
  selectedIntersectionId: string | null;
  onSelect: Dispatch<string>;
  // eslint-disable-next-line no-unused-vars
  onCreate: (latitude: number, longitude: number) => void;
}

function createMarkerIcon(intersection: Intersection, selected: boolean): L.DivIcon {
  const statusClass = intersection.verificationStatus === 'verified' ? 'verified' : 'pending';

  return L.divIcon({
    className: selected ? `numbered-map-marker ${statusClass} selected` : `numbered-map-marker ${statusClass}`,
    html: `<span aria-hidden="true">${intersection.mapNumber}</span>`,
    iconAnchor: [15, 15],
  });
}

export function IntersectionMap({ intersections, selectedIntersectionId, onSelect, onCreate }: IntersectionMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onCreateRef = useRef(onCreate);

  useEffect(() => {
    onCreateRef.current = onCreate;
  }, [onCreate]);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) {
      return;
    }

    const container = mapElementRef.current;
    const map = L.map(container, {
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

    const createAtPoint = (event: L.LeafletMouseEvent) => {
      onCreateRef.current(event.latlng.lat, event.latlng.lng);
    };
    map.on('click', createAtPoint);

    const invalidate = () => map.invalidateSize({ animate: false });
    const animationFrame = window.requestAnimationFrame(invalidate);
    const timeout = window.setTimeout(invalidate, 120);
    window.addEventListener('resize', invalidate);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            invalidate();
          });
    resizeObserver?.observe(container);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      window.removeEventListener('resize', invalidate);
      resizeObserver?.disconnect();
      map.off('click', createAtPoint);
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
        keyboard: true,
      });

      marker.bindTooltip(`${intersection.id} ${intersection.name}`);
      marker.on('click', () => onSelect(intersection.id));
      marker.addTo(markerLayer);
    });

    window.requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  }, [intersections, onSelect, selectedIntersectionId]);

  function createAtCenter(): void {
    const center = mapRef.current?.getCenter();
    onCreate(
      center?.lat ?? OAXACA_CENTER_POINT.latitude,
      center?.lng ?? OAXACA_CENTER_POINT.longitude,
    );
  }

  return (
    <section aria-label="Mapa real de intersecciones de Oaxaca" className="real-map">
      <button
        className="secondary"
        onClick={createAtCenter}
        style={{ position: 'absolute', left: 12, top: 12, zIndex: 1000 }}
        type="button"
      >
        Crear marcador en el centro del mapa
      </button>
      <div className="leaflet-map" ref={mapElementRef} />
    </section>
  );
}
