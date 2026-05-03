const BASE_URL = process.env.COINGECKO_API_URL ?? "https://api.coingecko.com/api/v3";

export async function getPrices(ids: string[]): Promise<Record<string, { brl: number; usd: number }>> {
  const url = `${BASE_URL}/simple/price?ids=${ids.join(",")}&vs_currencies=brl,usd`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
  return res.json() as Promise<Record<string, { brl: number; usd: number }>>;
}
