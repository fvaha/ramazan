import { z } from 'zod';

const API_BASE = 'https://api.aladhan.com/v1';

export type MethodId = number & { readonly __brand: 'MethodId' };

export interface PrayerTimings {
    readonly Fajr: string;
    readonly Sunrise: string;
    readonly Dhuhr: string;
    readonly Asr: string;
    readonly Sunset: string;
    readonly Maghrib: string;
    readonly Isha: string;
    readonly Imsak: string;
    readonly Midnight: string;
    readonly Firstthird: string;
    readonly Lastthird: string;
}

export interface HijriDate {
    readonly date: string;
    readonly day: string;
    readonly month: {
        readonly number: number;
        readonly en: string;
        readonly ar: string;
    };
    readonly year: string;
    readonly weekday: {
        readonly en: string;
        readonly ar: string;
    };
}

export interface GregorianDate {
    readonly date: string;
    readonly day: string;
    readonly month: {
        readonly number: number;
        readonly en: string;
    };
    readonly year: string;
    readonly weekday: {
        readonly en: string;
    };
}

export interface PrayerMeta {
    readonly latitude: number;
    readonly longitude: number;
    readonly timezone: string;
    readonly method: {
        readonly id: number;
        readonly name: string;
    };
    readonly school:
    | {
        readonly id: number;
        readonly name: string;
    }
    | string;
}

export interface PrayerData {
    readonly timings: PrayerTimings;
    readonly date: {
        readonly readable: string;
        readonly timestamp: string;
        readonly hijri: HijriDate;
        readonly gregorian: GregorianDate;
    };
    readonly meta: PrayerMeta;
}

const PrayerTimingsSchema = z.object({
    Fajr: z.string(),
    Sunrise: z.string(),
    Dhuhr: z.string(),
    Asr: z.string(),
    Sunset: z.string(),
    Maghrib: z.string(),
    Isha: z.string(),
    Imsak: z.string(),
    Midnight: z.string(),
    Firstthird: z.string(),
    Lastthird: z.string(),
});

const HijriDateSchema = z.object({
    date: z.string(),
    day: z.string(),
    month: z.object({
        number: z.number(),
        en: z.string(),
        ar: z.string(),
    }),
    year: z.string(),
    weekday: z.object({
        en: z.string(),
        ar: z.string(),
    }),
});

const GregorianDateSchema = z.object({
    date: z.string(),
    day: z.string(),
    month: z.object({
        number: z.number(),
        en: z.string(),
    }),
    year: z.string(),
    weekday: z.object({
        en: z.string(),
    }),
});

const PrayerMetaSchema = z.object({
    latitude: z.number(),
    longitude: z.number(),
    timezone: z.string(),
    method: z.object({
        id: z.number(),
        name: z.string(),
    }),
    school: z.union([
        z.object({
            id: z.number(),
            name: z.string(),
        }),
        z.string(),
    ]),
});

const PrayerDataSchema = z.object({
    timings: PrayerTimingsSchema,
    date: z.object({
        readable: z.string(),
        timestamp: z.string(),
        hijri: HijriDateSchema,
        gregorian: GregorianDateSchema,
    }),
    meta: PrayerMetaSchema,
});

const ApiEnvelopeSchema = z.object({
    code: z.number(),
    status: z.string(),
    data: z.unknown(),
});

const parseApiResponse = <T extends z.ZodTypeAny>(
    payload: unknown,
    dataSchema: T
): z.infer<T> => {
    const parsedEnvelope = ApiEnvelopeSchema.safeParse(payload);

    if (!parsedEnvelope.success) {
        throw new Error(
            `Invalid API response: ${parsedEnvelope.error.issues[0]?.message ?? 'Unknown schema mismatch'}`
        );
    }

    if (parsedEnvelope.data.code !== 200) {
        throw new Error(
            `API ${parsedEnvelope.data.code}: ${parsedEnvelope.data.status}`
        );
    }

    const parsedData = dataSchema.safeParse(parsedEnvelope.data.data);
    if (!parsedData.success) {
        throw new Error(
            `Invalid API response: ${parsedData.error.issues[0]?.message ?? 'Unknown schema mismatch'}`
        );
    }

    return parsedData.data;
};

const fetchAndParse = async <T extends z.ZodTypeAny>(
    url: string,
    dataSchema: T
): Promise<z.infer<T>> => {
    const response = await fetch(url);
    const json = (await response.json()) as unknown;
    return parseApiResponse(json, dataSchema);
};

export interface FetchCalendarByCityOptions {
    readonly city: string;
    readonly country: string;
    readonly year: number;
    readonly month?: number;
    readonly method?: number;
    readonly school?: number;
}

export const fetchCalendarByCity = async (
    opts: FetchCalendarByCityOptions
): Promise<ReadonlyArray<PrayerData>> => {
    const params = new URLSearchParams({
        city: opts.city,
        country: opts.country,
    });

    if (opts.method !== undefined) {
        params.set('method', String(opts.method));
    }

    if (opts.school !== undefined) {
        params.set('school', String(opts.school));
    }

    const path = opts.month ? `${opts.year}/${opts.month}` : String(opts.year);
    return fetchAndParse(
        `${API_BASE}/calendarByCity/${path}?${params}`,
        z.array(PrayerDataSchema)
    );
};

export const fetchHijriCalendarByCity = async (
    opts: {
        city: string;
        country: string;
        year: number;
        month: number;
        method?: number;
        school?: number;
    }
): Promise<ReadonlyArray<PrayerData>> => {
    const params = new URLSearchParams({
        city: opts.city,
        country: opts.country,
    });

    if (opts.method !== undefined) {
        params.set('method', String(opts.method));
    }

    if (opts.school !== undefined) {
        params.set('school', String(opts.school));
    }

    return fetchAndParse(
        `${API_BASE}/hijriCalendarByCity/${opts.year}/${opts.month}?${params}`,
        z.array(PrayerDataSchema)
    );
};
