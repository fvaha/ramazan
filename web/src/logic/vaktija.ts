import { fetchHijriCalendarByCity, type PrayerData } from './api';
import { getVaktijaLocationId } from './vaktija_locations';

interface VaktijaResponse {
    id: number;
    lokacija: string;
    godina: number;
    mjesec: {
        dan: {
            vakat: string[]; // [Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha]
        }[];
    }[];
}

const CACHE_PREFIX = 'vaktija_cache_';

const getCachedData = (id: number, year: number): VaktijaResponse | null => {
    try {
        const key = `${CACHE_PREFIX}${id}_${year}`;
        const cached = localStorage.getItem(key);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        console.error('Error reading from cache', e);
    }
    return null;
};

const setCachedData = (id: number, year: number, data: VaktijaResponse) => {
    try {
        const key = `${CACHE_PREFIX}${id}_${year}`;
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to cache vaktija data', e);
    }
};

const fetchVaktijaYearly = async (id: number, year: number): Promise<VaktijaResponse> => {
    // Check cache first
    const cached = getCachedData(id, year);
    if (cached) return cached;

    // Fetch from API
    const res = await fetch(`https://api.vaktija.ba/vaktija/v1/${id}/${year}`);
    if (!res.ok) throw new Error('Vaktija API fetch failed');

    const data = await res.json() as VaktijaResponse;

    // Validate structure lightly
    if (!data.mjesec || !Array.isArray(data.mjesec)) {
        throw new Error('Invalid Vaktija API response format');
    }

    // Cache it
    setCachedData(id, year, data);

    return data;
};

export const fetchVaktijaByCity = async (
    city: string,
    country: string,
    year: number,
    month: number // HIJRI month usually passed here, but we need Gregorian for Vaktija
): Promise<ReadonlyArray<PrayerData>> => {

    // 1. Fetch Aladhan data (Method 13 - Diyanet as base) to get dates and structure
    // We use Method 13 (Diyanet) as fallback if Vaktija fails
    const aladhanData = await fetchHijriCalendarByCity({
        city, country, year, month, method: 13
    });

    if (aladhanData.length === 0) return aladhanData;

    // 2. Resolve Vaktija Location ID
    const vaktijaId = getVaktijaLocationId(city);

    if (vaktijaId === null) {
        console.warn(`Vaktija ID not found for city: ${city}. Using Diyanet fallback.`);
        return aladhanData;
    }

    // 3. Fetch Vaktija Data (Yearly)
    // We need the Gregorian year from the first day of aladhan data to know which year to fetch from Vaktija
    // Note: Ramadan might span two Gregorian years (unlikely for 2026, but possible in Dec/Jan).
    // For simplicity, we fetch based on the first day's year.
    let vaktijaData: VaktijaResponse | null = null;
    const gregorianYear = parseInt(aladhanData[0].date.gregorian.year);

    try {
        vaktijaData = await fetchVaktijaYearly(vaktijaId, gregorianYear);
    } catch (err) {
        console.error('Failed to fetch Vaktija data', err);
        return aladhanData; // Fallback
    }

    if (!vaktijaData) return aladhanData;

    // 4. Merge Data
    return aladhanData.map(day => {
        // Parse Gregorian Date: DD-MM-YYYY
        const [d, m, y] = day.date.gregorian.date.split('-').map(Number);

        // Check if year matches (if month spans years, we might need another fetch, but ignore for now)
        if (y !== gregorianYear) {
            // If year changed, we strictly should fetch the other year.
            // But for Ramadan 2026 (Feb/Mar), it's all 2026.
            // If it mismatches, return original (Diyanet).
            return day;
        }

        // Access Vaktija Data
        // m is 1-based (1=Jan). Vaktija array is 0-based.
        // d is 1-based. Vaktija array is 0-based.
        const monthData = vaktijaData?.mjesec[m - 1];
        const dayData = monthData?.dan[d - 1];

        if (dayData && dayData.vakat && dayData.vakat.length >= 6) {
            const v = dayData.vakat;
            return {
                ...day,
                meta: {
                    ...day.meta,
                    method: {
                        id: 99,
                        name: 'Takvim IZ u BiH (Vaktija.ba)'
                    }
                },
                timings: {
                    ...day.timings,
                    Fajr: v[0],
                    Sunrise: v[1],
                    Dhuhr: v[2],
                    Asr: v[3],
                    Maghrib: v[4],
                    Isha: v[5],
                    Sunset: v[4], // Maghrib starts at sunset
                    Imsak: v[0] // Imsak = Fajr in Vaktija usually (or similar)
                }
            };
        }

        return day;
    });
};
