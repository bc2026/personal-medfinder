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

const MOCK_PHARMACIES: PharmacyResult[] = [
  {
    name: "Community Care Pharmacy",
    address: "120 Main St",
    phone: "(555) 201-4400",
    distanceMiles: 0.8,
    source: "mock",
  },
  {
    name: "Riverside Drug & Wellness",
    address: "88 Oak Ave",
    phone: "(555) 310-2299",
    distanceMiles: 1.4,
    source: "mock",
  },
  {
    name: "Northside Family Pharmacy",
    address: "410 Cedar Ln",
    phone: "(555) 882-1100",
    distanceMiles: 2.1,
    source: "mock",
  },
  {
    name: "Green Valley Apothecary",
    address: "9 Park Plaza",
    phone: "(555) 447-9001",
    distanceMiles: 3.0,
    source: "mock",
  },
  {
    name: "Metro Health Rx",
    address: "2200 Broadway",
    phone: "(555) 600-7788",
    distanceMiles: 4.2,
    source: "mock",
  },
];

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
    headers: { "User-Agent": "PersonalMedfinder/1.0 (local MVP)" },
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error("Overpass API unavailable");

  const json = (await res.json()) as {
    elements: {
      tags?: { name?: string; "addr:street"?: string; phone?: string };
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

    results.push({
      name,
      address,
      phone: el.tags?.phone,
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

export async function findNearbyPharmacies(
  zipCode: string,
  radiusMiles: number
): Promise<{ pharmacies: PharmacyResult[]; usedFallback: boolean }> {
  const provider = process.env.PHARMACY_SEARCH_PROVIDER ?? "nominatim";

  if (provider === "mock") {
    return {
      pharmacies: MOCK_PHARMACIES.filter(
        (p) => (p.distanceMiles ?? 0) <= radiusMiles
      ),
      usedFallback: true,
    };
  }

  try {
    const origin = await geocodeZip(zipCode);
    if (!origin) {
      return { pharmacies: MOCK_PHARMACIES, usedFallback: true };
    }

    const pharmacies = await searchNominatim(origin, radiusMiles);
    if (pharmacies.length === 0) {
      return { pharmacies: MOCK_PHARMACIES, usedFallback: true };
    }

    return { pharmacies, usedFallback: false };
  } catch {
    return { pharmacies: MOCK_PHARMACIES, usedFallback: true };
  }
}
