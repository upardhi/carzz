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
  /** Custom label for the address field */
  addressLabel?: string;
  /** Hides the address text input if we want to render it outside */
  hideAddressInput?: boolean;
  onAddressChange: (address: string) => void;
  onCoordinatesChange: (lat: number | null, lng: number | null) => void;
}

/** Parses latitude and longitude from various Google Maps URL formats. */
export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Pattern 0: Direct coordinates like "21.1458, 79.0882" or "21.1458,79.0882"
  const directCoordMatch = trimmed.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (directCoordMatch) {
    const lat = parseFloat(directCoordMatch[1]);
    const lng = parseFloat(directCoordMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

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

export interface GeoSearchResult {
  display_name: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

export function LocationPickerMap({
  address,
  lat,
  lng,
  city = 'Nagpur',
  addressRequired = false,
  addressLabel,
  hideAddressInput = false,
  onAddressChange,
  onCoordinatesChange,
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([]);

  // Reverse Geocoding helper via Nominatim & Photon
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
            return;
          }
        }

        // Photon reverse geocode fallback
        const photonRes = await fetch(
          `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`,
        );
        if (photonRes.ok) {
          const pData = await photonRes.json();
          if (pData?.features?.[0]?.properties) {
            const p = pData.features[0].properties;
            const parts = [p.name, p.street, p.district, p.city, p.state].filter(Boolean);
            if (parts.length > 0) {
              onAddressChange(parts.join(', '));
            }
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
        const zoomLevel = lat && lng ? 16 : 13;

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

          map.setView([lat, lng], Math.max(map.getZoom(), 15));
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

  // GPS "Use Current Location" handler
  const handleUseCurrentLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setSearchError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setIsLocating(false);
        const cLat = Number(position.coords.latitude.toFixed(6));
        const cLng = Number(position.coords.longitude.toFixed(6));

        onCoordinatesChange(cLat, cLng);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([cLat, cLng], 16);
        }
        await reverseGeocode(cLat, cLng);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          setSearchError('Location permission denied. Please enable GPS access or click on the map.');
        } else if (err.code === 2) {
          setSearchError('Position unavailable. Please search your apartment or tap on the map.');
        } else {
          setSearchError('Location request timed out. Please try searching.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [onCoordinatesChange, reverseGeocode]);

  // Multi-engine search supporting apartments, small societies, buildings, and landmarks
  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearchError('');
    setSearchResults([]);

    // 1. Check if user typed or pasted raw coordinates / Google Maps URL
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

    setIsSearching(true);
    try {
      const candidates: GeoSearchResult[] = [];
      const seenCoords = new Set<string>();

      const addCandidate = (item: GeoSearchResult) => {
        const key = `${item.lat.toFixed(4)},${item.lng.toFixed(4)}`;
        if (!seenCoords.has(key)) {
          seenCoords.add(key);
          candidates.push(item);
        }
      };

      const centerLat = lat ?? FALLBACK_LAT;
      const centerLng = lng ?? FALLBACK_LNG;

      // Engine 1: Photon OpenStreetMap Elastic Geocoder (great for apartments, small societies, buildings)
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lat=${centerLat}&lon=${centerLng}`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (Array.isArray(pData?.features)) {
            for (const f of pData.features) {
              const coords = f.geometry?.coordinates;
              if (Array.isArray(coords) && coords.length >= 2) {
                const lon = Number(Number(coords[0]).toFixed(6));
                const cLat = Number(Number(coords[1]).toFixed(6));
                const p = f.properties || {};
                const parts = [
                  p.name,
                  p.housenumber ? `No. ${p.housenumber}` : '',
                  p.street,
                  p.district || p.suburb || p.locality,
                  p.city,
                  p.state,
                  p.postcode,
                ].filter(Boolean);
                const title = p.name || parts[0] || query;
                const subtitle = parts.filter((s) => s !== title).join(', ');
                addCandidate({
                  display_name: parts.join(', ') || title,
                  title,
                  subtitle,
                  lat: cLat,
                  lng: lon,
                });
              }
            }
          }
        }
      } catch {
        // Continue to next engine
      }

      // Engine 2: OpenStreetMap Nominatim with direct query
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`,
          { headers: { 'User-Agent': 'CarzzWeb-App/1.0' } },
        );
        if (nomRes.ok) {
          const nData = await nomRes.json();
          if (Array.isArray(nData)) {
            for (const item of nData) {
              const cLat = Number(parseFloat(item.lat).toFixed(6));
              const cLng = Number(parseFloat(item.lon).toFixed(6));
              const parts = (item.display_name || '').split(',');
              const title = parts[0]?.trim() || item.display_name;
              const subtitle = parts.slice(1).join(',').trim();
              addCandidate({
                display_name: item.display_name,
                title,
                subtitle,
                lat: cLat,
                lng: cLng,
              });
            }
          }
        }
      } catch {
        // Continue
      }

      // Engine 3: Fallback with city appended if no results and city wasn't in search text
      if (candidates.length === 0 && city && !query.toLowerCase().includes(city.toLowerCase())) {
        try {
          const cityQuery = `${query}, ${city}`;
          const photonCityUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(cityQuery)}&limit=6&lat=${centerLat}&lon=${centerLng}`;
          const pRes = await fetch(photonCityUrl);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (Array.isArray(pData?.features)) {
              for (const f of pData.features) {
                const coords = f.geometry?.coordinates;
                if (Array.isArray(coords) && coords.length >= 2) {
                  const lon = Number(Number(coords[0]).toFixed(6));
                  const cLat = Number(Number(coords[1]).toFixed(6));
                  const p = f.properties || {};
                  const parts = [
                    p.name,
                    p.street,
                    p.district || p.suburb,
                    p.city,
                    p.state,
                  ].filter(Boolean);
                  addCandidate({
                    display_name: parts.join(', ') || p.name,
                    title: p.name || parts[0] || cityQuery,
                    subtitle: parts.slice(1).join(', '),
                    lat: cLat,
                    lng: lon,
                  });
                }
              }
            }
          }
        } catch {
          // Continue
        }
      }

      if (candidates.length > 0) {
        if (candidates.length === 1) {
          selectSearchResult(candidates[0]);
        } else {
          setSearchResults(candidates);
        }
      } else {
        setSearchError('Location not found. Try searching a nearby landmark/road or click directly on the map.');
      }
    } catch {
      setSearchError('Could not search location. Please click directly on the map.');
    } finally {
      setIsSearching(false);
    }
  }

  function selectSearchResult(item: GeoSearchResult) {
    onCoordinatesChange(item.lat, item.lng);
    if (item.display_name) {
      onAddressChange(item.display_name);
    }

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([item.lat, item.lng], 16);
    }
    setSearchResults([]);
    setSearchQuery('');
  }

  function handleClearLocation() {
    onCoordinatesChange(null, null);
    setSearchError('');
    setSearchResults([]);
  }

  return (
    <div className="space-y-3">
      {/* Address Text Field */}
      {!hideAddressInput && (
        <div>
          <label className="field-label" htmlFor="garage-address">
            {addressRequired
              ? `${addressLabel || 'Garage / Hub Address'} *`
              : `${addressLabel || 'Garage / Hub Address'} (Optional)`}
          </label>
          <input
            id="garage-address"
            className="field text-sm"
            placeholder="e.g. Flat 302, Palm Heights, Near Toll Plaza, Wardha Road"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            required={addressRequired}
          />
        </div>
      )}

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
        <div className="relative">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search apartment, society, landmark or paste Google Maps link..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                className="w-full rounded-lg border border-line bg-white py-1.5 pl-8 pr-3 text-xs placeholder:text-ink-mute focus:border-blue-600 focus:outline-hidden"
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
              className="w-full sm:w-auto justify-center shrink-0 font-semibold"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="w-full sm:w-auto justify-center shrink-0 font-semibold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
              title="Detect your device GPS coordinates"
            >
              {isLocating ? 'Locating GPS…' : '📍 Current Location'}
            </Button>
          </div>

          {/* Search Result Suggestions Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
              <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Select matching location ({searchResults.length})
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSearchResult(item)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-800 hover:bg-blue-50 hover:text-blue-900 rounded-lg transition-colors flex items-start gap-1.5"
                >
                  <span className="text-blue-600 shrink-0 mt-0.5">📍</span>
                  <span className="line-clamp-2 leading-snug">{item.display_name}</span>
                </button>
              ))}
            </div>
          )}
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
