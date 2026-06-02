import { useState } from "react";
import { apiCalculate, apiSubmitInquiry, formatDate, formatPrice } from "../api";
import type { CalcResult } from "../api";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = ["Typ zákazníka", "Parametry dřeva", "Vlhkost", "Shrnutí a cena", "Kontakt"];

const SPECIES_OPTIONS = [
  { value: "smrk", label: "Smrk", hard: false, emoji: "🌲" },
  { value: "borovice", label: "Borovice", hard: false, emoji: "🌲" },
  { value: "dub", label: "Dub", hard: true, emoji: "🌳" },
  { value: "buk", label: "Buk", hard: true, emoji: "🌳" },
  { value: "jasan", label: "Jasan", hard: true, emoji: "🌳" },
];

const TARGET_OPTIONS = [
  { value: "12-15", label: "12–15 %", use: "Stavební dřevo, trámy" },
  { value: "8-11", label: "8–11 %", use: "Truhlářská výroba" },
  { value: "6-8", label: "6–8 %", use: "Nábytek, interiér" },
];

const MOISTURE_PRESETS = [
  { value: 55, label: "Čerstvě pokácené (≈ 55 %)" },
  { value: 35, label: "Proschlé venku 1 rok (≈ 35 %)" },
  { value: 25, label: "Proschlé venku 2+ roky (≈ 25 %)" },
  { value: 0, label: "Zadám číslo ručně" },
];

const LUMBER_OPTIONS = [
  { value: "fosny", label: "Fošny", desc: "Desky 40–80 mm" },
  { value: "hranoly", label: "Hranoly", desc: "Nosné prvky 100+ mm" },
  { value: "prkna", label: "Prkna", desc: "Tenké desky do 38 mm" },
];

interface FormState {
  customerType: "B2C" | "B2B";
  species: string;
  volumeM3: string;
  thicknessMm: string;
  lumberKind: string;
  inputMoisturePct: string;
  moisturePreset: number;
  targetBand: string;
  name: string;
  email: string;
  phone: string;
  ico: string;
  dic: string;
}

const INIT: FormState = {
  customerType: "B2C",
  species: "",
  volumeM3: "",
  thicknessMm: "50",
  lumberKind: "fosny",
  inputMoisturePct: "55",
  moisturePreset: 55,
  targetBand: "8-11",
  name: "",
  email: "",
  phone: "",
  ico: "",
  dic: "",
};

export default function Configurator() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(INIT);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState("");

  const set = (key: keyof FormState, val: string | number) =>
    setForm((f) => ({ ...f, [key]: val }));

  async function goToStep4() {
    setLoading(true);
    setError("");
    try {
      const result = await apiCalculate({
        customerType: form.customerType,
        species: form.species,
        volumeM3: parseFloat(form.volumeM3),
        inputMoisturePct: parseFloat(form.inputMoisturePct),
        targetBand: form.targetBand,
        thicknessMm: parseFloat(form.thicknessMm),
        lumberKind: form.lumberKind,
      });
      setCalcResult(result);
      setStep(4);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await apiSubmitInquiry({
        customerType: form.customerType,
        species: form.species,
        volumeM3: parseFloat(form.volumeM3),
        inputMoisturePct: parseFloat(form.inputMoisturePct),
        targetBand: form.targetBand,
        thicknessMm: parseFloat(form.thicknessMm),
        lumberKind: form.lumberKind,
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        ico: form.ico || undefined,
        dic: form.dic || undefined,
      });
      setSubmittedId(res.orderId);
      setSubmitted(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) return <SuccessScreen orderId={submittedId} onReset={() => { setForm(INIT); setStep(1); setSubmitted(false); setCalcResult(null); }} />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
      <StepBar current={step} steps={STEPS} />

      {error && (
        <div style={{ background: "#fee", border: "1px solid #fcc", borderRadius: 8, padding: "12px 16px", marginBottom: 24, color: "#c00" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Krok 1 — typ zákazníka */}
      {step === 1 && (
        <StepCard title="Jste soukromá osoba nebo firma?">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {(["B2C", "B2B"] as const).map((t) => (
              <ChoiceCard
                key={t}
                selected={form.customerType === t}
                onClick={() => set("customerType", t)}
                icon={t === "B2C" ? "🪚" : "🏭"}
                title={t === "B2C" ? "Soukromá osoba" : "Firma / IČO"}
                desc={t === "B2C" ? "Truhlář, kutil, soukromník — ceny zobrazeny s DPH." : "Pila, výroba, stavební firma — ceny bez DPH, faktura."}
              />
            ))}
          </div>
          <NavRow onNext={() => setStep(2)} nextLabel="Dál →" />
        </StepCard>
      )}

      {/* Krok 2 — parametry dřeva */}
      {step === 2 && (
        <StepCard title="Jaké dřevo chcete sušit?">
          <Label>Druh dřeva</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10, marginBottom: 24 }}>
            {SPECIES_OPTIONS.map((s) => (
              <ChoiceCard
                key={s.value}
                selected={form.species === s.value}
                onClick={() => set("species", s.value)}
                icon={s.emoji}
                title={s.label}
                desc={s.hard ? "Tvrdé" : "Měkké"}
                small
              />
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <Label>Objem (m³)</Label>
              <Input
                type="number" min="0.1" max="20" step="0.1"
                value={form.volumeM3}
                onChange={(v) => set("volumeM3", v)}
                placeholder="např. 3.5"
              />
              <Hint>Maximální kapacita komory je 20 m³.</Hint>
            </div>
            <div>
              <Label>Tloušťka řeziva (mm)</Label>
              <Input
                type="number" min="10" max="250"
                value={form.thicknessMm}
                onChange={(v) => set("thicknessMm", v)}
                placeholder="např. 50"
              />
              <Hint>Nelineárně ovlivňuje délku sušení.</Hint>
            </div>
          </div>

          <Label>Typ řeziva</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 8 }}>
            {LUMBER_OPTIONS.map((l) => (
              <ChoiceCard
                key={l.value}
                selected={form.lumberKind === l.value}
                onClick={() => set("lumberKind", l.value)}
                title={l.label}
                desc={l.desc}
                small
              />
            ))}
          </div>

          <NavRow
            onBack={() => setStep(1)}
            onNext={() => {
              if (!form.species) { setError("Vyberte druh dřeva."); return; }
              if (!form.volumeM3 || parseFloat(form.volumeM3) <= 0) { setError("Zadejte platný objem."); return; }
              setError(""); setStep(3);
            }}
            nextLabel="Dál →"
          />
        </StepCard>
      )}

      {/* Krok 3 — vlhkost */}
      {step === 3 && (
        <StepCard title="Vlhkost dřeva">
          <Label>Vstupní vlhkost — co nejlépe popisuje vaše dřevo?</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            {MOISTURE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  set("moisturePreset", p.value);
                  if (p.value > 0) set("inputMoisturePct", String(p.value));
                }}
                style={{
                  padding: "12px 16px", borderRadius: 8, textAlign: "left",
                  border: `2px solid ${form.moisturePreset === p.value ? "#8B4513" : "#e5e0d8"}`,
                  background: form.moisturePreset === p.value ? "#faf3ec" : "#fff",
                  fontSize: 14, fontWeight: form.moisturePreset === p.value ? 600 : 400,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {form.moisturePreset === 0 && (
            <div style={{ marginBottom: 16 }}>
              <Label>Přesná hodnota vlhkosti (%)</Label>
              <Input
                type="number" min="5" max="80"
                value={form.inputMoisturePct}
                onChange={(v) => set("inputMoisturePct", v)}
                placeholder="např. 42"
              />
            </div>
          )}

          <Label>Cílová vlhkost — na co dřevo bude?</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {TARGET_OPTIONS.map((t) => (
              <ChoiceCard
                key={t.value}
                selected={form.targetBand === t.value}
                onClick={() => set("targetBand", t.value)}
                title={t.label}
                desc={t.use}
                small
              />
            ))}
          </div>

          <NavRow
            onBack={() => setStep(2)}
            onNext={goToStep4}
            nextLabel={loading ? "Počítám…" : "Spočítat →"}
            nextDisabled={loading}
          />
        </StepCard>
      )}

      {/* Krok 4 — výsledek */}
      {step === 4 && calcResult && (
        <StepCard title="Výsledek kalkulace">
          <div style={{ background: "#fff", border: "1px solid #e5e0d8", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ResultBox
                label="Odhadovaná cena"
                value={formatPrice(calcResult.price.display, calcResult.price.withVat)}
                sub={calcResult.price.minPriceApplied ? "Platí minimální cena zakázky" : undefined}
                accent
              />
              <ResultBox
                label="Délka sušení"
                value={`${calcResult.duration.minDays}–${calcResult.duration.maxDays} dní`}
                sub={`Střední odhad: ${calcResult.duration.days} dní`}
              />
              {calcResult.placements[0] && (
                <>
                  <ResultBox
                    label="Nejbližší nástup"
                    value={formatDate(calcResult.placements[0].earliestStart)}
                    sub={calcResult.placements[0].kind === "JOIN_EXISTING" ? "Připojení k existující vsázce" : "Nová vsázka"}
                  />
                  {calcResult.expectedFinish && (
                    <ResultBox
                      label="Předpokládané dokončení"
                      value={formatDate(calcResult.expectedFinish)}
                    />
                  )}
                </>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#999", marginTop: 16, textAlign: "center" }}>
              * {calcResult.note} · Koeficienty v{calcResult.pricingVersion}
            </p>
          </div>

          {calcResult.price.withVat && (
            <div style={{ fontSize: 13, color: "#666", marginBottom: 16, padding: "10px 14px", background: "#f9f6f2", borderRadius: 8 }}>
              Bez DPH: {formatPrice(calcResult.price.net, false)} · DPH (21 %): {calcResult.price.vat.toLocaleString("cs-CZ")} Kč
            </div>
          )}

          <NavRow
            onBack={() => setStep(3)}
            onNext={() => setStep(5)}
            nextLabel="Odeslat poptávku →"
          />
        </StepCard>
      )}

      {/* Krok 5 — kontakt */}
      {step === 5 && (
        <StepCard title="Vaše kontaktní údaje">
          <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>
            Poptávka je nezávazná. Provozovatel ji potvrdí do 1–2 pracovních dnů.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div>
              <Label>Jméno a příjmení *</Label>
              <Input value={form.name} onChange={(v) => set("name", v)} placeholder="Jan Novák" />
            </div>
            <div>
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(v) => set("email", v)} placeholder="jan@example.cz" />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input type="tel" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+420 123 456 789" />
            </div>
          </div>

          {form.customerType === "B2B" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <Label>IČO</Label>
                <Input value={form.ico} onChange={(v) => set("ico", v)} placeholder="12345678" />
              </div>
              <div>
                <Label>DIČ</Label>
                <Input value={form.dic} onChange={(v) => set("dic", v)} placeholder="CZ12345678" />
              </div>
            </div>
          )}

          <NavRow
            onBack={() => setStep(4)}
            onNext={() => {
              if (!form.name.trim()) { setError("Zadejte jméno."); return; }
              if (!form.email.trim()) { setError("Zadejte e-mail."); return; }
              setError(""); handleSubmit();
            }}
            nextLabel={loading ? "Odesílám…" : "Odeslat poptávku ✓"}
            nextDisabled={loading}
          />
        </StepCard>
      )}
    </div>
  );
}

// --- Sub-komponenty ---

function StepBar({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 8 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < current ? "#8B4513" : "#e5e0d8",
              marginRight: i < steps.length - 1 ? 4 : 0,
              transition: "background .3s",
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 13, color: "#888" }}>
        Krok {current} z {steps.length}: <strong style={{ color: "#5a3a1a" }}>{steps[current - 1]}</strong>
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: "#2a1a0a" }}>{title}</h2>
      {children}
    </div>
  );
}

function ChoiceCard({
  selected, onClick, icon, title, desc, small
}: {
  selected: boolean; onClick: () => void; icon?: string; title: string; desc: string; small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? "#8B4513" : "#e5e0d8"}`,
        background: selected ? "#faf3ec" : "#fff",
        borderRadius: 10, padding: small ? "12px 10px" : "20px",
        textAlign: "left", cursor: "pointer", transition: "all .15s",
      }}
    >
      {icon && <div style={{ fontSize: small ? 24 : 32, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontWeight: 600, fontSize: small ? 13 : 15, color: "#2a1a0a" }}>{title}</div>
      <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{desc}</div>
    </button>
  );
}

function ResultBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? "#faf3ec" : "#f8f5f0",
      borderRadius: 8, padding: "16px",
      border: accent ? "1px solid #ddb88a" : "1px solid #e8e3da",
    }}>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: accent ? 22 : 18, fontWeight: 700, color: accent ? "#8B4513" : "#2a1a0a" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function NavRow({
  onBack, onNext, nextLabel, nextDisabled
}: {
  onBack?: () => void; onNext: () => void; nextLabel: string; nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32, gap: 12 }}>
      {onBack ? (
        <button onClick={onBack} style={backBtnStyle}>← Zpět</button>
      ) : <div />}
      <button
        onClick={onNext}
        disabled={nextDisabled}
        style={{ ...nextBtnStyle, opacity: nextDisabled ? 0.6 : 1 }}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: "#3a2a1a" }}>{children}</div>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>{children}</div>;
}

function Input({
  value, onChange, type = "text", placeholder, min, max, step
}: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string; max?: string; step?: string;
}) {
  return (
    <input
      type={type} value={value} placeholder={placeholder}
      min={min} max={max} step={step}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: 8,
        border: "1.5px solid #d5cfc6", fontSize: 15, outline: "none",
        background: "#fff",
      }}
    />
  );
}

function SuccessScreen({ orderId, onReset }: { orderId: string; onReset: () => void }) {
  return (
    <div style={{ maxWidth: 520, margin: "80px auto", textAlign: "center", padding: "0 24px" }}>
      <div style={{ fontSize: 64, marginBottom: 24 }}>✅</div>
      <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Poptávka odeslána!</h2>
      <p style={{ color: "#666", marginBottom: 8, lineHeight: 1.6 }}>
        Provozovatel vás brzy kontaktuje na zadaný e-mail.
      </p>
      <div style={{ fontSize: 13, color: "#aaa", fontFamily: "monospace", marginBottom: 32 }}>
        ID zakázky: {orderId}
      </div>
      <button onClick={onReset} style={{ ...nextBtnStyle }}>
        Zadat novou poptávku
      </button>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: "12px 24px", borderRadius: 8, border: "1.5px solid #d5cfc6",
  background: "#fff", color: "#5a4a3a", fontWeight: 500, fontSize: 15,
};
const nextBtnStyle: React.CSSProperties = {
  padding: "12px 28px", borderRadius: 8, border: "none",
  background: "#8B4513", color: "#fff", fontWeight: 600, fontSize: 15,
  cursor: "pointer",
};
