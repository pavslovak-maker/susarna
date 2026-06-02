const BASE = "/api";

export interface CalcRequest {
  species: string;
  volumeM3: number;
  inputMoisturePct: number;
  targetBand: string;
  thicknessMm: number;
  lumberKind: string;
  customerType: "B2C" | "B2B";
}

export interface CalcResult {
  duration: { days: number; minDays: number; maxDays: number };
  price: { display: number; withVat: boolean; net: number; vat: number; gross: number; minPriceApplied: boolean };
  placements: { kind: string; chamberId: string; earliestStart: string; freeM3: number; reason: string }[];
  expectedFinish: string | null;
  pricingVersion: number;
  note: string;
}

export interface InquiryRequest extends CalcRequest {
  name: string;
  email: string;
  phone?: string;
  ico?: string;
  dic?: string;
}

export async function apiCalculate(data: CalcRequest): Promise<CalcResult> {
  const res = await fetch(`${BASE}/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chyba výpočtu");
  }
  return res.json();
}

export async function apiSubmitInquiry(data: InquiryRequest) {
  const res = await fetch(`${BASE}/inquiries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chyba odeslání");
  }
  return res.json();
}

export async function apiGetInquiries() {
  const res = await fetch(`${BASE}/inquiries`);
  return res.json();
}

export async function apiGetStats() {
  const res = await fetch(`${BASE}/admin/stats`);
  return res.json();
}

export async function apiUpdateStatus(id: string, status: string) {
  const res = await fetch(`${BASE}/inquiries/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Chyba aktualizace");
  }
  return res.json();
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric", month: "long", year: "numeric"
  });
}

export function formatPrice(czk: number, withVat: boolean) {
  return czk.toLocaleString("cs-CZ") + " Kč" + (withVat ? " vč. DPH" : " bez DPH");
}
