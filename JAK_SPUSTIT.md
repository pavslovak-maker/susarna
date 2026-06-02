# Jak spustit aplikaci

## Co budeš potřebovat
- **Node.js** (verze 18 nebo novější) — stáhni z https://nodejs.org
- Terminál (na Windows: PowerShell nebo příkazový řádek)

---

## 1. Otevři složku projektu v terminálu

```
cd cesta\k\susarna-core
```

---

## 2. Nainstaluj závislosti backendu (jednou)

```
npm install
```

---

## 3. Nainstaluj závislosti frontendu (jednou)

```
cd web
npm install
cd ..
```

---

## 4. Spusť aplikaci

```
npm run dev
```

Tím se spustí **oba servery najednou**:
- 🟢 Backend API: http://localhost:3000
- 🌐 Frontend (web): http://localhost:5173

**Otevři prohlížeč na adrese http://localhost:5173**

---

## Co aplikace umí

### Pro zákazníka (http://localhost:5173)
- Výběr druhu zákazníka (soukromá osoba / firma)
- Průvodce konfigurací zakázky (druh dřeva, objem, vlhkost, tloušťka)
- Okamžitý výpočet ceny a délky sušení
- Zobrazení dostupných termínů
- Odeslání poptávky s kontaktními údaji

### Pro provozovatele — Admin (http://localhost:5173 → tlačítko Admin)
- Přehled všech poptávek s filtry
- Detail zakázky
- Změna stavu zakázky (Poptávka → Potvrzeno → Naskladněno → Suší → Hotovo → …)
- Přehled komor K1 a K2

---

## Databáze

Databáze se vytvoří automaticky jako soubor `susarna.db` v kořeni projektu.
Při prvním spuštění se automaticky přidají:
- 2 sušicí komory (K1, K2) — kapacita 20 m³ každá
- Výchozí ceník (verze 1)

---

## Zastavení aplikace

Stiskni `Ctrl+C` v terminálu.
