const BASE_URL = "https://brapi.dev/api";

export async function getQuotes(tickers: string[]): Promise<{ ticker: string; price: number; change: number }[]> {
  const token = process.env.BRAPI_TOKEN;
  const params = new URLSearchParams({ token: token ?? "" });
  const url = `${BASE_URL}/quote/${tickers.join(",")}?${params}`;

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Brapi error: ${res.status}`);

  const data = await res.json() as { results?: { symbol: string; regularMarketPrice: number; regularMarketChangePercent: number }[] };
  return (data.results ?? []).map((r) => ({
    ticker: r.symbol,
    price: r.regularMarketPrice,
    change: r.regularMarketChangePercent,
  }));
}
