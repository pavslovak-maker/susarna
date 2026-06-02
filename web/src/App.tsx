import { useState } from "react";
import Configurator from "./pages/Configurator";
import AdminDashboard from "./pages/AdminDashboard";

export default function App() {
  const [page, setPage] = useState<"home" | "konfigurator" | "admin">("home");

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={navStyle}>
        <div style={navInner}>
          <span style={logo} onClick={() => setPage("home")}>🪵 SušárnaOnline</span>
          <div style={{ display: "flex", gap: 8 }}>
            <NavBtn active={page === "konfigurator"} onClick={() => setPage("konfigurator")}>
              Objednat sušení
            </NavBtn>
            <NavBtn active={page === "admin"} onClick={() => setPage("admin")}>
              Admin
            </NavBtn>
          </div>
        </div>
      </nav>

      {page === "home" && <HomePage onStart={() => setPage("konfigurator")} />}
      {page === "konfigurator" && <Configurator />}
      {page === "admin" && <AdminDashboard />}
    </div>
  );
}

function HomePage({ onStart }: { onStart: () => void }) {
  return (
    <div>
      {/* Hero */}
      <div style={heroStyle}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 42, fontWeight: 700, marginBottom: 16, lineHeight: 1.2 }}>
            Zakázkové sušení dřeva
          </h1>
          <p style={{ fontSize: 18, color: "#5a4a3a", marginBottom: 32, lineHeight: 1.6 }}>
            Profesionální komorové sušení pro truhláře, pilařské závody i kutily.
            Zadejte parametry dřeva a okamžitě zjistíte cenu i termín.
          </p>
          <button onClick={onStart} style={primaryBtn}>
            Spočítat cenu a termín →
          </button>
        </div>
      </div>

      {/* Jak to funguje */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "60px 24px" }}>
        <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, marginBottom: 40 }}>
          Jak to funguje?
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 24 }}>
          {[
            { icon: "⚙️", title: "1. Nakonfigurujete", text: "Zadáte druh dřeva, objem, vlhkost a tloušťku." },
            { icon: "💰", title: "2. Dostanete odhad", text: "Systém okamžitě spočítá orientační cenu a délku sušení." },
            { icon: "📅", title: "3. Vyberete termín", text: "Zobrazí se volné komory a nejbližší možný nástup." },
            { icon: "✅", title: "4. Potvrdíme", text: "Provozovatel vaši poptávku potvrdí a vy budete informováni." },
          ].map((s) => (
            <div key={s.title} style={cardStyle}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{s.title}</div>
              <div style={{ color: "#666", fontSize: 14, lineHeight: 1.5 }}>{s.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Druhy dřeva */}
      <div style={{ background: "#fff", padding: "60px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <h2 style={{ textAlign: "center", fontSize: 28, fontWeight: 700, marginBottom: 40 }}>
            Sušíme tyto druhy dřeva
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            {["Smrk", "Borovice", "Dub", "Buk", "Jasan"].map((d) => (
              <span key={d} style={tagStyle}>{d}</span>
            ))}
          </div>
        </div>
      </div>

      <footer style={{ textAlign: "center", padding: "32px 24px", color: "#888", fontSize: 13 }}>
        © 2026 SušárnaOnline · Zakázkové sušení dřeva
      </footer>
    </div>
  );
}

function NavBtn({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: 8, border: "none",
        background: active ? "#8B4513" : "transparent",
        color: active ? "#fff" : "#5a4a3a",
        fontWeight: 500, fontSize: 14, transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

const navStyle: React.CSSProperties = {
  background: "#fff", borderBottom: "1px solid #e5e0d8",
  position: "sticky", top: 0, zIndex: 100,
};
const navInner: React.CSSProperties = {
  maxWidth: 960, margin: "0 auto", padding: "0 24px",
  height: 60, display: "flex", alignItems: "center", justifyContent: "space-between",
};
const logo: React.CSSProperties = {
  fontSize: 20, fontWeight: 700, color: "#8B4513", cursor: "pointer",
};
const heroStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #3d2b1f 0%, #6b3a2a 100%)",
  color: "#fff", padding: "80px 24px",
};
const primaryBtn: React.CSSProperties = {
  background: "#f0a040", color: "#1a1a1a", border: "none",
  padding: "14px 32px", borderRadius: 10, fontSize: 16,
  fontWeight: 600, cursor: "pointer",
};
const cardStyle: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e0d8",
  borderRadius: 12, padding: "24px", textAlign: "center",
};
const tagStyle: React.CSSProperties = {
  background: "#f0ece6", color: "#5a3a1a",
  padding: "8px 20px", borderRadius: 20, fontSize: 15, fontWeight: 500,
};
