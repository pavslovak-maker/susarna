import type { OrderStatus } from "./types.js";

/**
 * Povolené přechody stavů (kap. 7.2). Explicitní whitelist místo „cokoli kamkoli“
 * brání nesmyslným skokům (např. POPTAVKA → FAKTUROVANO) a chrání data integritu.
 * ZRUSENO je dosažitelné z každé nefinální fáze (zadání: „z jakékoli fáze“).
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  POPTAVKA: ["POTVRZENO", "ZRUSENO"],
  POTVRZENO: ["NASKLADNENO", "ZRUSENO"],
  NASKLADNENO: ["SUSI", "ZRUSENO"],
  SUSI: ["HOTOVO", "ZRUSENO"],
  HOTOVO: ["ODEBRANO", "ZRUSENO"],
  ODEBRANO: ["FAKTUROVANO"],
  FAKTUROVANO: [], // finální
  ZRUSENO: [], // finální
};

export class IllegalTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Nepovolený přechod stavu: ${from} → ${to}`);
    this.name = "IllegalTransitionError";
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

export function isFinal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
