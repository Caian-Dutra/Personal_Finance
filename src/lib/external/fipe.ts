const BASE_URL = process.env.FIPE_API_URL ?? "https://parallelum.com.br/fipe/api/v1";

export async function getBrands(type: "carros" | "motos" | "caminhoes") {
  const res = await fetch(`${BASE_URL}/${type}/marcas`);
  if (!res.ok) throw new Error(`FIPE error: ${res.status}`);
  return res.json() as Promise<{ codigo: string; nome: string }[]>;
}

export async function getModels(type: string, brandCode: string) {
  const res = await fetch(`${BASE_URL}/${type}/marcas/${brandCode}/modelos`);
  if (!res.ok) throw new Error(`FIPE error: ${res.status}`);
  return res.json() as Promise<{ modelos: { codigo: number; nome: string }[] }>;
}

export async function getYears(type: string, brandCode: string, modelCode: string) {
  const res = await fetch(`${BASE_URL}/${type}/marcas/${brandCode}/modelos/${modelCode}/anos`);
  if (!res.ok) throw new Error(`FIPE error: ${res.status}`);
  return res.json() as Promise<{ codigo: string; nome: string }[]>;
}

export async function getPrice(type: string, brandCode: string, modelCode: string, yearCode: string) {
  const res = await fetch(`${BASE_URL}/${type}/marcas/${brandCode}/modelos/${modelCode}/anos/${yearCode}`);
  if (!res.ok) throw new Error(`FIPE error: ${res.status}`);
  return res.json() as Promise<{ Valor: string; Marca: string; Modelo: string; AnoModelo: number; Combustivel: string }>;
}
