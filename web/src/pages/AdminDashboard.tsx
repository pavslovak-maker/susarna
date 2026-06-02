import { useEffect, useState } from "react";
import { apiGetInquiries, apiGetStats, apiUpdateStatus, formatDate, formatPrice } from "../api";

const STATUS_LABELS: Record<string, string> = {
  POPTAVKA: "Poptávka",
  POTVRZENO: "Potvrzeno",
  NASKLADNENO: "Naskladněno",
  SUSI: "Suší",
  HOTOVO: "Hotovo",
  ODEBRANO: "Odebráno",
  FAKTUROVANO: "Fakturováno",
  ZRUSENO: "Zrušeno",
};

const STATUS_COLORS: Record<string, string> = {
  POPTAVKA: "#e8a020",
  POTVRZENO: "#2080e8",
  NASKLADNENO: "#8b6020",
  SUSI: "#20a060",
  HOTOVO: "#208060",
  ODEBRANO: "#888",
  FAKTUROVANO: "#555",
  ZRUSENO: "#c00",
};

// Povolené přechody (musí souhlasit s workflow.ts)
const NEXT_STATUSES: Record<string, string[]> = {
  POPTAVKA: ["POTVRZENO", "ZRUSENO"],
  POTVRZENO: ["NASKLADNENO", "ZRUSENO"],
  NASKLADNENO: ["SUSI", "ZRUSENO"],
  SUSI: ["HOTOVO", "ZRUSENO"],
  HOTOVO: ["ODEBRANO", "ZRUSENO"],
  ODEBRANO: ["FAKTUROVANO"],
  FAKTUROVANO: [],
  ZRUSENO: [],
};

interface Order {
  id: string;
  status: string;
  species: string;
  volume_m3: number;
  target_band: string;
  estimated_days: number;
  net_price_czk: number;
  created_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_type: "B2C" | "B2B";
}

interface Stats {
  total: number;
  byStatus: { status: string; n: number }[];
  chambers: { id: string; capacity_m3: number; state: string }[];
  activeCycles: { id: string; chamber_id: string; species: string; starts_at: string; ends_at: string; used_m3: number; capacity_m3: number }[];
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [detail, setDetail] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  async function loadData() {
    setLoading(true);
    const [o, s] = await Promise.all([apiGetInquiries(), apiGetStats()]);
    setOrders(o);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function changeStatus(id: string, newStatus: string) {
    try {
      await apiUpdateStatus(id, newStatus);
      setStatusMsg(`Stav změněn na: ${STATUS_LABELS[newStatus]}`);
      setTimeout(() => setStatusMsg(""), 3000);
      loadData();
      setDetail(null);
    } catch (e: unknown) {
      setStatusMsg("Chyba: " + (e as Error).message);
    }
  }

  const filtered = filterStatus === "ALL" ? orders : orders.filter((o) => o.status === filterStatus);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Admin — správa zakázek</h1>

      {statusMsg && (
        <div style={{ background: "#efffef", border: "1px solid #8c8", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#060" }}>
          {statusMsg}
        </div>
      )}

      {/* Statistiky */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 32 }}>
          <StatCard label="Celkem zakázek" value={String(stats.total)} />
          {stats.byStatus.map((s) => (
            <StatCard key={s.status} label={STATUS_LABELS[s.status] ?? s.status} value={String(s.n)} color={STATUS_COLORS[s.status]} />
          ))}
        </div>
      )}

      {/* Komory */}
      {stats && stats.chambers.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Sušicí komory</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {stats.chambers.map((ch) => {
              const cycle = stats.activeCycles.find((c) => c.chamber_id === ch.id);
              return (
                <div key={ch.id} style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 10, padding: "16px 20px", minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Komora {ch.id}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>Kapacita: {ch.capacity_m3} m³</div>
                  {cycle ? (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      <span style={{ background: "#e8f4e8", color: "#060", padding: "2px 8px", borderRadius: 4 }}>
                        {cycle.species} · {cycle.used_m3}/{ch.capacity_m3} m³
                      </span>
                      <div style={{ color: "#888", marginTop: 4 }}>
                        {formatDate(cycle.starts_at)} – {formatDate(cycle.ends_at)}
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, fontSize: 13 }}>
                      <span style={{ background: "#f0faf0", color: "#080", padding: "2px 8px", borderRadius: 4 }}>Volná</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtr */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <FilterBtn value="ALL" current={filterStatus} onClick={setFilterStatus}>Všechny</FilterBtn>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <FilterBtn key={k} value={k} current={filterStatus} onClick={setFilterStatus}>{v}</FilterBtn>
        ))}
      </div>

      {/* Tabulka */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Načítám…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Žádné zakázky.</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8f5f0" }}>
                {["Zákazník", "Druh / Objem", "Cena (bez DPH)", "Stav", "Datum", "Akce"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e0d8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} style={{ borderBottom: "1px solid #f0ece8", background: i % 2 === 0 ? "#fff" : "#fdfcfb" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{o.customer_name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{o.customer_email}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{o.customer_type}</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{o.species}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>{o.volume_m3} m³ · cíl {o.target_band} %</div>
                    <div style={{ fontSize: 12, color: "#aaa" }}>{o.estimated_days} dní</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600 }}>{formatPrice(o.net_price_czk, false)}</div>
                  </td>
                  <td style={tdStyle}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: "#666" }}>{formatDate(o.created_at)}</div>
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => setDetail(o)}
                      style={{ padding: "6px 12px", border: "1px solid #d5cfc6", borderRadius: 6, background: "#fff", fontSize: 13, cursor: "pointer" }}
                    >
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{ background: "#fff", borderRadius: 16, padding: 32, maxWidth: 540, width: "100%", maxHeight: "90vh", overflow: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>Detail zakázky</h2>
              <button onClick={() => setDetail(null)} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: "#888" }}>✕</button>
            </div>

            <InfoRow label="Zákazník" value={detail.customer_name} />
            <InfoRow label="E-mail" value={detail.customer_email} />
            {detail.customer_phone && <InfoRow label="Telefon" value={detail.customer_phone} />}
            <InfoRow label="Typ" value={detail.customer_type} />
            <div style={{ borderTop: "1px solid #f0ece8", margin: "16px 0" }} />
            <InfoRow label="Druh dřeva" value={detail.species} />
            <InfoRow label="Objem" value={`${detail.volume_m3} m³`} />
            <InfoRow label="Cílová vlhkost" value={`${detail.target_band} %`} />
            <InfoRow label="Odhad délky" value={`${detail.estimated_days} dní`} />
            <InfoRow label="Cena (bez DPH)" value={formatPrice(detail.net_price_czk, false)} />
            <InfoRow label="Vytvořeno" value={formatDate(detail.created_at)} />
            <div style={{ borderTop: "1px solid #f0ece8", margin: "16px 0" }} />

            <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Aktuální stav: <StatusBadge status={detail.status} /></div>

            {NEXT_STATUSES[detail.status]?.length > 0 && (
              <div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>Posunout na:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {NEXT_STATUSES[detail.status].map((s) => (
                    <button
                      key={s}
                      onClick={() => changeStatus(detail.id, s)}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none",
                        background: s === "ZRUSENO" ? "#fee" : "#eef4ff",
                        color: s === "ZRUSENO" ? "#c00" : "#048",
                        fontWeight: 600, fontSize: 13, cursor: "pointer",
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: color ?? "#2a1a0a" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 12,
      background: STATUS_COLORS[status] + "22", color: STATUS_COLORS[status],
      fontSize: 12, fontWeight: 600,
    }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function FilterBtn({ value, current, onClick, children }: { value: string; current: string; onClick: (v: string) => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => onClick(value)}
      style={{
        padding: "6px 12px", borderRadius: 6, border: "1px solid #e0dbd2", fontSize: 13,
        background: current === value ? "#8B4513" : "#fff",
        color: current === value ? "#fff" : "#5a4a3a",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 14 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const tdStyle: React.CSSProperties = { padding: "12px 16px", verticalAlign: "top" };
