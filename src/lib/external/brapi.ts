const BASE = "https://brapi.dev/api";

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const token = process.env.BRAPI_TOKEN;
  if (token) params.token = token;
  const qs = new URLSearchParams(params).toString();
  return `${BASE}${path}${qs ? `?${qs}` : ""}`;
}

export interface BrapiQuote {
  ticker: string;
  price: number;
  change1d: number;
  name: string;
}

export interface BrapiHistoricalPrice {
  date: string; // YYYY-MM-DD
  close: number;
}

export async function getQuotes(tickers: string[]): Promise<BrapiQuote[]> {
  if (tickers.length === 0) return [];

  const url = buildUrl(`/quote/${tickers.join(",")}`);
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Brapi quotes ${res.status}: ${body.message ?? res.statusText}`);
  }

  const data = await res.json() as {
    results?: {
      symbol: string;
      shortName: string;
      regularMarketPrice: number;
      regularMarketChangePercent: number;
    }[];
  };

  return (data.results ?? []).map((r) => ({
    ticker: r.symbol,
    price: r.regularMarketPrice,
    change1d: r.regularMarketChangePercent ?? 0,
    name: r.shortName ?? r.symbol,
  }));
}

export async function getPriceHistory(ticker: string): Promise<BrapiHistoricalPrice[]> {
  // range=5y gives more history; free tickers work without token
  const url = buildUrl(`/quote/${ticker}`, { range: "5y", interval: "1d" });
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`Brapi history ${ticker} ${res.status}: ${body.message ?? res.statusText}`);
  }

  const data = await res.json() as {
    results?: {
      historicalDataPrice?: {
        date: number;   // Unix timestamp in SECONDS
        close: number;
        adjustedClose?: number;
      }[];
    }[];
  };

  const raw = data.results?.[0]?.historicalDataPrice ?? [];

  return raw
    .filter((p) => typeof p.close === "number" && p.close > 0 && typeof p.date === "number")
    .map((p) => ({
      // p.date is seconds → multiply by 1000 for ms
      date: new Date(p.date * 1000).toISOString().slice(0, 10),
      close: p.adjustedClose ?? p.close,
    }))
    .filter((p, i, arr) => {
      // deduplicate same date (keep first)
      return arr.findIndex((x) => x.date === p.date) === i;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
