import { parsePharmacyPhone } from "../lib/phone.js";

export interface PharmacyResult {
  name: string;
  address: string;
  phone?: string;
  lat?: number;
  lng?: number;
  distanceMiles?: number;
  source: string;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

const USER_AGENT = "PersonalMedfinder/1.0 (local MVP)";

const MOCK_PHARMACIES: PharmacyResult[] = [
  {
    name: "Community Care Pharmacy",
    address: "120 Main St",
    distanceMiles: 0.8,
    source: "mock",
  },
  {
    name: "Riverside Drug & Wellness",
    address: "88 Oak Ave",
    distanceMiles: 1.4,
    source: "mock",
  },
  {
    name: "Northside Family Pharmacy",
    address: "410 Cedar Ln",
    distanceMiles: 2.1,
    source: "mock",
  },
  {
    name: "Green Valley Apothecary",
    address: "9 Park Plaza",
    distanceMiles: 3.0,
    source: "mock",
  },
  {
    name: "Metro Health Rx",
    address: "2200 Broadway",
    distanceMiles: 4.2,
    source: "mock",
  },
];

/** Spread mock pharmacies around a ZIP center so the map works in fallback mode. */
function positionMockPharmacies(
  origin: GeoPoint,
  pharmacies: PharmacyResult[]
): PharmacyResult[] {
  const offsets = [
    { dLat: 0.012, dLng: 0.008 },
    { dLat: -0.009, dLng: 0.014 },
    { dLat: 0.018, dLng: -0.011 },
    { dLat: -0.015, dLng: -0.006 },
    { dLat: 0.006, dLng: 0.02 },
  ];
  return pharmacies.map((p, i) => {
    const o = offsets[i % offsets.length];
    const lat = origin.lat + o.dLat;
    const lng = origin.lng + o.dLng;
    return {
      ...p,
      lat,
      lng,
      distanceMiles: haversineMiles(origin, { lat, lng }),
    };
  });
}

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function geocodeZip(zipCode: string): Promise<GeoPoint | null> {
  const zip = zipCode.slice(0, 5);
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { lat: string; lon: string }[];
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

async function searchNominatim(
  origin: GeoPoint,
  radiusMiles: number
): Promise<PharmacyResult[]> {
  const delta = radiusMiles / 69;
  const south = origin.lat - delta;
  const north = origin.lat + delta;
  const west = origin.lng - delta;
  const east = origin.lng + delta;

  const query = `[out:json][timeout:25];
(
  node["amenity"="pharmacy"](${south},${west},${north},${east});
  way["amenity"="pharmacy"](${south},${west},${north},${east});
);
out center 30;`;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error("Overpass API unavailable");

  const json = (await res.json()) as {
    elements: {
      tags?: {
        name?: string;
        "addr:street"?: string;
        phone?: string;
        "contact:phone"?: string;
      };
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }[];
  };

  const results: PharmacyResult[] = [];

  for (const el of json.elements ?? []) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;

    const distanceMiles = haversineMiles(origin, { lat, lng });
    if (distanceMiles > radiusMiles) continue;

    const street = el.tags?.["addr:street"] ?? "";
    const name = el.tags?.name ?? "Pharmacy";
    const address = street || "Address unavailable";

    const phone = parsePharmacyPhone(
      el.tags?.phone ?? el.tags?.["contact:phone"]
    );

    results.push({
      name,
      address,
      phone: phone ?? undefined,
      lat,
      lng,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      source: "nominatim",
    });
  }

  return results
    .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
    .slice(0, 25);
}

function milesToMeters(miles: number): number {
  return Math.min(miles * 1609.34, 50_000);
}

async function geocodeZipGoogle(
  zipCode: string,
  apiKey: string
): Promise<GeoPoint | null> {
  const zip = zipCode.slice(0, 5);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set(
    "components",
    `postal_code:${zip}|country:US`
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status: string;
    results: { geometry: { location: { lat: number; lng: number } } }[];
  };

  if (data.status !== "OK" || !data.results.length) return null;

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

async function searchGooglePlaces(
  origin: GeoPoint,
  radiusMiles: number,
  apiKey: string
): Promise<PharmacyResult[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber",
      },
      body: JSON.stringify({
        includedPrimaryTypes: ["pharmacy"],
        maxResultCount: 20,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: {
              latitude: origin.lat,
              longitude: origin.lng,
            },
            radius: milesToMeters(radiusMiles),
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Google Places API error (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const json = (await res.json()) as {
    places?: {
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      internationalPhoneNumber?: string;
      nationalPhoneNumber?: string;
    }[];
  };

  const results: PharmacyResult[] = [];

  for (const place of json.places ?? []) {
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (lat == null || lng == null) continue;

    const distanceMiles = haversineMiles(origin, { lat, lng });
    if (distanceMiles > radiusMiles) continue;

    const phone = parsePharmacyPhone(
      place.internationalPhoneNumber ?? place.nationalPhoneNumber
    );

    results.push({
      name: place.displayName?.text ?? "Pharmacy",
      address: place.formattedAddress ?? "Address unavailable",
      phone: phone ?? undefined,
      lat,
      lng,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      source: "google",
    });
  }

  return results
    .sort((a, b) => (a.distanceMiles ?? 0) - (b.distanceMiles ?? 0))
    .slice(0, 25);
}

async function searchWithGoogle(
  zipCode: string,
  radiusMiles: number
): Promise<{ pharmacies: PharmacyResult[]; usedFallback: boolean }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "PHARMACY_SEARCH_PROVIDER=google but GOOGLE_PLACES_API_KEY is not set"
    );
    return mockForZip(zipCode, radiusMiles);
  }

  const origin = await geocodeZipGoogle(zipCode, apiKey);
  if (!origin) {
    return mockForZip(zipCode, radiusMiles);
  }

  const pharmacies = await searchGooglePlaces(origin, radiusMiles, apiKey);
  if (pharmacies.length === 0) {
    return mockForZip(zipCode, radiusMiles, origin);
  }

  return { pharmacies, usedFallback: false };
}

async function searchWithNominatim(
  zipCode: string,
  radiusMiles: number
): Promise<{ pharmacies: PharmacyResult[]; usedFallback: boolean }> {
  const origin = await geocodeZip(zipCode);
  if (!origin) {
    return mockForZip(zipCode, radiusMiles);
  }

  const pharmacies = await searchNominatim(origin, radiusMiles);
  if (pharmacies.length === 0) {
    return mockForZip(zipCode, radiusMiles, origin);
  }

  return { pharmacies, usedFallback: false };
}

async function mockForZip(
  zipCode: string,
  radiusMiles: number,
  origin?: GeoPoint
): Promise<{ pharmacies: PharmacyResult[]; usedFallback: boolean }> {
  const center = origin ?? (await geocodeZip(zipCode));
  const filtered = MOCK_PHARMACIES.filter(
    (p) => (p.distanceMiles ?? 0) <= radiusMiles
  );
  if (!center) {
    return { pharmacies: filtered, usedFallback: true };
  }
  return {
    pharmacies: positionMockPharmacies(center, filtered),
    usedFallback: true,
  };
}

export async function findNearbyPharmacies(
  zipCode: string,
  radiusMiles: number
): Promise<{ pharmacies: PharmacyResult[]; usedFallback: boolean }> {
  const provider = process.env.PHARMACY_SEARCH_PROVIDER ?? "nominatim";

  if (provider === "mock") {
    return mockForZip(zipCode, radiusMiles);
  }

  try {
    if (provider === "google") {
      return await searchWithGoogle(zipCode, radiusMiles);
    }
    return await searchWithNominatim(zipCode, radiusMiles);
  } catch (err) {
    console.error("Pharmacy search failed:", err);
    return mockForZip(zipCode, radiusMiles);
  }
}
