'use client';

// Leaflet is loaded from a CDN <script> tag rather than installed as a
// dependency (see loadLeaflet below), so there is no @types/leaflet to type
// window.L or the objects it hands back — `any` here is the untyped global,
// not a shortcut around real types that exist.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from './primitives';

declare global {
  interface Window {
    L: any;
  }
}

interface LocationPickerMapProps {
  address: string;
  lat: number | null;
  lng: number | null;
  city?: string;
  /** Whether the text address is mandatory to submit the form it's in — false (optional) by default. */
  addressRequired?: boolean;
  onAddressChange: (address: string) => void;
  onCoordinatesChange: (lat: number | null, lng: number | null) => void;
}

/** Parses latitude and longitude from various Google Maps URL formats. */
export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed.includes('http') && !trimmed.includes('maps') && !trimmed.includes('goo.gl')) return null;

  // Pattern 1: @21.1458,79.0882
  const atMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 2: q=21.1458,79.0882 or ll=21.1458,79.0882 or loc:21.1458,79.0882
  const paramMatch = trimmed.match(/(?:q|ll|loc:)=?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 3: !3d21.1458!4d79.0882 (Google Maps share / embed URL)
  const dMatch = trimmed.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dMatch) {
    const lat = parseFloat(dMatch[1]);
    const lng = parseFloat(dMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  return null;
}

/** Dynamically loads Leaflet CSS & JS from CDN if not already loaded. */
function loadLeaflet(): Promise<typeof window.L> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return;
    if (window.L) {
      resolve(window.L);
      return;
    }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (document.getElementById('leaflet-js')) {
      const existingScript = document.getElementById('leaflet-js') as HTMLScriptElement;
      existingScript.addEventListener('load', () => {
        if (window.L) resolve(window.L);
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet script failed to initialize.'));
    };
    script.onerror = () => reject(new Error('Failed to load Leaflet map.'));
    document.body.appendChild(script);
  });
}

// Default fallback coordinates: Nagpur, India center
const FALLBACK_LAT = 21.1458;
const FALLBACK_LNG = 79.0882;

export function LocationPickerMap({
  address,
  lat,
  lng,
  city = 'Nagpur',
  addressRequired = false,
  onAddressChange,
  onCoordinatesChange,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Reverse Geocoding helper via Nominatim
  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number) => {
      setIsGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': 'CarzzWeb-App/1.0' } },
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            onAddressChange(data.display_name);
          }
        }
      } catch {
        // Ignore reverse geocoding network errors silently
      } finally {
        setIsGeocoding(false);
      }
    },
    [onAddressChange],
  );

  // Initialize or update Leaflet Map
  useEffect(() => {
    let isMounted = true;

    loadLeaflet()
      .then((L) => {
        if (!isMounted || !mapContainerRef.current) return;

        // Custom default marker icon URLs
        const defaultIcon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        });

        const currentLat = lat ?? FALLBACK_LAT;
        const currentLng = lng ?? FALLBACK_LNG;
        const zoomLevel = lat && lng ? 15 : 12;

        if (!mapInstanceRef.current) {
          const map = L.map(mapContainerRef.current, {
            center: [currentLat, currentLng],
            zoom: zoomLevel,
            zoomControl: true,
          });

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
            maxZoom: 19,
          }).addTo(map);

          // Click on map to place pin
          map.on('click', (e: any) => {
            const clickLat = Number(e.latlng.lat.toFixed(6));
            const clickLng = Number(e.latlng.lng.toFixed(6));

            if (markerInstanceRef.current) {
              markerInstanceRef.current.setLatLng([clickLat, clickLng]);
            } else {
              const newMarker = L.marker([clickLat, clickLng], {
                draggable: true,
                icon: defaultIcon,
              }).addTo(map);

              newMarker.on('dragend', (event: any) => {
                const pos = event.target.getLatLng();
                const dLat = Number(pos.lat.toFixed(6));
                const dLng = Number(pos.lng.toFixed(6));
                onCoordinatesChange(dLat, dLng);
                reverseGeocode(dLat, dLng);
              });

              markerInstanceRef.current = newMarker;
            }

            onCoordinatesChange(clickLat, clickLng);
            reverseGeocode(clickLat, clickLng);
          });

          mapInstanceRef.current = map;
          setMapLoaded(true);
        }

        const map = mapInstanceRef.current;

        // Position or update marker
        if (lat !== null && lng !== null) {
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setLatLng([lat, lng]);
          } else {
            const newMarker = L.marker([lat, lng], {
              draggable: true,
              icon: defaultIcon,
            }).addTo(map);

            newMarker.on('dragend', (event: any) => {
              const pos = event.target.getLatLng();
              const dLat = Number(pos.lat.toFixed(6));
              const dLng = Number(pos.lng.toFixed(6));
              onCoordinatesChange(dLat, dLng);
              reverseGeocode(dLat, dLng);
            });

            markerInstanceRef.current = newMarker;
          }

          map.setView([lat, lng], Math.max(map.getZoom(), 14));
        } else if (markerInstanceRef.current) {
          map.removeLayer(markerInstanceRef.current);
          markerInstanceRef.current = null;
        }

        // Trigger map resize check for inside modal rendering
        setTimeout(() => {
          map.invalidateSize();
        }, 200);
      })
      .catch((err) => {
        console.error(err);
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng, onCoordinatesChange, reverseGeocode]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerInstanceRef.current = null;
      }
    };
  }, []);

  // Handle Search input or Google Maps Link search
  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchError('');

    // Check if user pasted a Google Maps URL
    const gmapsCoords = parseGoogleMapsUrl(query);
    if (gmapsCoords) {
      onCoordinatesChange(gmapsCoords.lat, gmapsCoords.lng);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([gmapsCoords.lat, gmapsCoords.lng], 16);
      }
      setSearchQuery('');
      await reverseGeocode(gmapsCoords.lat, gmapsCoords.lng);
      return;
    }

    // Otherwise, perform Nominatim address search
    setIsSearching(true);
    try {
      const fullQuery = query.toLowerCase().includes(city.toLowerCase())
        ? query
        : `${query}, ${city}`;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`,
        { headers: { 'User-Agent': 'CarzzWeb-App/1.0' } },
      );

      if (!res.ok) throw new Error('Search request failed.');

      const results = await res.json();
      if (results && results.length > 0) {
        const item = results[0];
        const sLat = Number(parseFloat(item.lat).toFixed(6));
        const sLng = Number(parseFloat(item.lon).toFixed(6));

        onCoordinatesChange(sLat, sLng);
        if (item.display_name) {
          onAddressChange(item.display_name);
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([sLat, sLng], 15);
        }
        setSearchQuery('');
      } else {
        setSearchError('Location not found. Try clicking directly on the map.');
      }
    } catch {
      setSearchError('Could not search location. Please tap/click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  }

  function handleClearLocation() {
    onCoordinatesChange(null, null);
    setSearchError('');
  }

  return (
    <div className="space-y-3">
      {/* Address Text Field */}
      <div>
        <label className="field-label" htmlFor="garage-address">
          {addressRequired ? 'Garage / Hub Address *' : 'Garage / Hub Address (Optional)'}
        </label>
        <input
          id="garage-address"
          className="field text-sm"
          placeholder="e.g. Plot 14, MIDC Area, Near Toll Plaza"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          required={addressRequired}
        />
      </div>

      {/* Interactive Map & Search Section */}
      <div className="rounded-xl border border-line bg-surface-elevated p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-navy-950 flex items-center gap-1.5">
            <span>🗺️</span>
            <span>Interactive Location Picker</span>
          </span>
          {lat !== null && lng !== null ? (
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              Location Set
            </span>
          ) : (
            <span className="text-[11px] text-ink-mute">Tap map to place pin</span>
          )}
        </div>

        {/* Search / Google Maps URL Box */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search area, landmark or paste Google Maps link..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="w-full rounded-lg border border-line bg-white py-1.5 pl-8 pr-3 text-xs placeholder:text-ink-mute focus:border-blue-600 focus:outline-none"
            />
            <svg
              className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-ink-mute"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleSearch()}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? 'Locating…' : 'Search / Locate'}
          </Button>
        </div>

        {searchError ? (
          <p className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-md">
            ⚠️ {searchError}
          </p>
        ) : null}

        {/* Leaflet Map Canvas */}
        <div className="relative rounded-lg overflow-hidden border border-line bg-slate-100 h-52">
          <div ref={mapContainerRef} className="w-full h-full z-0" suppressHydrationWarning />
          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-xs text-ink-mute font-medium">
              Loading map view…
            </div>
          )}
          {isGeocoding && (
            <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-xs border border-line px-2.5 py-1 rounded-md text-[11px] font-semibold text-navy-900 shadow-xs flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
              <span>Updating address…</span>
            </div>
          )}
        </div>

        {/* Selected Location Details & Clear Action */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {lat !== null && lng !== null ? (
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-ink-mute bg-white px-2.5 py-1 rounded border border-line">
              <span className="text-emerald-600 font-bold">📍</span>
              <span>
                Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-ink-mute italic">
              Click anywhere on map or drag pin marker to set coordinates
            </span>
          )}

          {lat !== null && lng !== null ? (
            <button
              type="button"
              onClick={handleClearLocation}
              className="text-[11px] font-semibold text-rose-600 hover:underline px-1"
            >
              Remove Pin
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
