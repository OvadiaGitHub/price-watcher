"use client";

import { useEffect, useState } from "react";

type ProductType = "hotel" | "flight";

// Seuils (défauts + minimums)
const DEFAULTS = {
  hotel: { abs: 10, pct: 0.05 },  // 10€ / 5%
  flight: { abs: 20, pct: 0.04 }, // 20€ / 4%
};
const MIN = { abs: 5, pct: 0.03 };

export default function HomePage() {
  const [productType, setProductType] = useState<ProductType>("hotel");
  const [customizeThresholds, setCustomizeThresholds] = useState(false);

  // état du formulaire (contrôlé)
  const [form, setForm] = useState({
    // commun
    price_paid: "",
    currency_paid: "EUR",
    threshold_abs: String(DEFAULTS.hotel.abs),
    threshold_pct: String(DEFAULTS.hotel.pct),

    // hôtel
    url: "",
    checkin: "",
    checkout: "",

    // vol
    origin_iata: "",
    destination_iata: "",
    departure_date: "",
    return_date: "",
    adults: "1",
    children: "0",
    infants: "0",
    cabin: "ECONOMY",
    bags: "0",
    direct_only: false as boolean,
  });

  // Pré-remplissage via ?url=&checkin=&checkout=&price=&curr=&adults=&children= …
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);

    const url  = p.get("url") || "";
    const cin  = p.get("checkin") || "";
    const cout = p.get("checkout") || "";
    const price =
      p.get("price") || p.get("price_paid") || p.get("price_total") || "";
    const curr =
      (p.get("curr") || p.get("currency") || p.get("currency_code") || "")
        .toUpperCase();
    const adults   = p.get("adults")   || "";
    const children = p.get("children") || "";

    if (url) setProductType("hotel");

    setForm(f => ({
      ...f,
      url: url || f.url,
      checkin: cin || f.checkin,
      checkout: cout || f.checkout,
      price_paid: price || f.price_paid,
      currency_paid: curr || f.currency_paid,
      adults: adults || f.adults,
      children: children || f.children,
    }));
  }, []);

  // si on change de type, appliquer les défauts correspondants
  useEffect(() => {
    setForm(f => ({
      ...f,
      threshold_abs: String(DEFAULTS[productType].abs),
      threshold_pct: String(DEFAULTS[productType].pct),
    }));
    setCustomizeThresholds(false);
  }, [productType]);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? !!checked : value }));
  };

  function clampThresholds(body: any) {
    if (body.threshold_abs != null) {
      body.threshold_abs = Math.max(MIN.abs, Number(body.threshold_abs));
    }
    if (body.threshold_pct != null) {
      body.threshold_pct = Math.max(MIN.pct, Number(body.threshold_pct));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const body: any = {
        price_paid: Number(form.price_paid),
        currency_paid: form.currency_paid.toUpperCase(),
      };

      // Seuils (perso ou défauts)
      if (customizeThresholds) {
        body.threshold_abs = Number(form.threshold_abs);
        body.threshold_pct = Number(form.threshold_pct);
      } else {
        body.threshold_abs = DEFAULTS[productType].abs;
        body.threshold_pct = DEFAULTS[productType].pct;
      }
      clampThresholds(body);

      if (productType === "hotel") {
        body.url = form.url;
        if (!body.url) throw new Error("URL (hôtel) requise");
        if (form.checkin) body.checkin = form.checkin;
        if (form.checkout) body.checkout = form.checkout;
      } else {
        if (form.origin_iata) body.origin_iata = form.origin_iata.trim().toUpperCase();
        if (form.destination_iata) body.destination_iata = form.destination_iata.trim().toUpperCase();
        if (form.departure_date) body.departure_date = form.departure_date;
        if (form.return_date) body.return_date = form.return_date;
        body.adults = Number(form.adults || 1);
        body.children = Number(form.children || 0);
        body.infants = Number(form.infants || 0);
        body.cabin = form.cabin || "ECONOMY";
        body.bags = Number(form.bags || 0);
        body.direct_only = !!form.direct_only;
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur inconnue");

      setMsg(`✅ Surveillance ${productType} enregistrée (id: ${json.booking?.id ?? "?"})`);

      // reset (on garde le type)
      setCustomizeThresholds(false);
      setForm(f => ({
        ...f,
        price_paid: "",
        currency_paid: "EUR",
        threshold_abs: String(DEFAULTS[productType].abs),
        threshold_pct: String(DEFAULTS[productType].pct),
        url: "",
        checkin: "",
        checkout: "",
        origin_iata: "",
        destination_iata: "",
        departure_date: "",
        return_date: "",
        adults: "1",
        children: "0",
        infants: "0",
        cabin: "ECONOMY",
        bags: "0",
        direct_only: false,
      }));
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runCheck() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/checks/run");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur check");
      setMsg(`🔎 ${json.message}`);
    } catch (e:any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const thresholdsDisabled = !customizeThresholds;

  return (
    <div style={{maxWidth: 860, margin: "40px auto", padding: 20}}>
      <h1>Price Watcher — MVP</h1>
      <p>Suivi de prix d’une réservation modifiable/annulable.</p>

      {/* Sélecteur de type */}
      <div style={{marginTop: 16}}>
        <label style={{marginRight: 12}}>
          <input
            type="radio"
            name="productType"
            checked={productType === "hotel"}
            onChange={() => setProductType("hotel")}
          /> Hôtel
        </label>
        <label>
          <input
            type="radio"
            name="productType"
            checked={productType === "flight"}
            onChange={() => setProductType("flight")}
          /> Vol
        </label>
      </div>

      {/* Toggle personnalisation seuils */}
      <div style={{marginTop: 12}}>
        <label>
          <input
            type="checkbox"
            checked={customizeThresholds}
            onChange={(e) => setCustomizeThresholds(e.target.checked)}
          />{" "}
          Personnaliser les seuils (par défaut : {DEFAULTS[productType].abs}€ / {(DEFAULTS[productType].pct*100).toFixed(0)}%)
        </label>
      </div>

      <form onSubmit={onSubmit} style={{display:"grid", gap:12, marginTop: 16}}>
        {/* Commun */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 180px 200px", gap:12}}>
          <label>
            Prix payé (€) *
            <input name="price_paid" value={form.price_paid} onChange={onChange} required type="number" step="0.01" min="0"/>
          </label>
          <label>
            Devise *
            <input name="currency_paid" value={form.currency_paid} onChange={onChange} required />
          </label>
          <label title={`Minimum ${MIN.abs} €`} style={thresholdsDisabled ? {opacity:0.5} : undefined}>
            Seuil € (min {MIN.abs})
            <input
              name="threshold_abs"
              value={form.threshold_abs}
              onChange={onChange}
              type="number"
              step="0.01"
              min={MIN.abs}
              disabled={thresholdsDisabled}
            />
          </label>
          <label title={`Minimum ${(MIN.pct*100).toFixed(0)}%`} style={thresholdsDisabled ? {opacity:0.5} : undefined}>
            Seuil % (min {(MIN.pct*100).toFixed(0)}%)
            <input
              name="threshold_pct"
              value={form.threshold_pct}
              onChange={onChange}
              type="number"
              step="0.0001"
              min={MIN.pct}
              disabled={thresholdsDisabled}
            />
          </label>
        </div>

        {/* Hôtel */}
        {productType === "hotel" && (
          <>
            <label>
              URL de réservation (hôtel) *
              <input
                name="url"
                value={form.url}
                onChange={onChange}
                placeholder="https://www.booking.com/..."
                required
                style={{width:"100%"}}
              />
            </label>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <label>
                Check-in
                <input name="checkin" value={form.checkin} onChange={onChange} type="date"/>
              </label>
              <label>
                Check-out
                <input name="checkout" value={form.checkout} onChange={onChange} type="date"/>
              </label>
            </div>
          </>
        )}

        {/* Vol */}
        {productType === "flight" && (
          <>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <label>
                Origine IATA (ex: CDG) *
                <input name="origin_iata" value={form.origin_iata} onChange={onChange} maxLength={3} placeholder="CDG" required />
              </label>
              <label>
                Destination IATA (ex: LIS) *
                <input name="destination_iata" value={form.destination_iata} onChange={onChange} maxLength={3} placeholder="LIS" required />
              </label>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
              <label>
                Départ *
                <input name="departure_date" value={form.departure_date} onChange={onChange} type="date" required />
              </label>
              <label>
                Retour (optionnel)
                <input name="return_date" value={form.return_date} onChange={onChange} type="date" />
              </label>
            </div>

            <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:12}}>
              <label>
                Adultes
                <input name="adults" value={form.adults} onChange={onChange} type="number" min={1}/>
              </label>
              <label>
                Enfants
                <input name="children" value={form.children} onChange={onChange} type="number" min={0}/>
              </label>
              <label>
                Bébés
                <input name="infants" value={form.infants} onChange={onChange} type="number" min={0}/>
              </label>
              <label>
                Cabine
                <select name="cabin" value={form.cabin} onChange={onChange}>
                  <option value="ECONOMY">ECONOMY</option>
                  <option value="PREMIUM_ECONOMY">PREMIUM_ECONOMY</option>
                  <option value="BUSINESS">BUSINESS</option>
                  <option value="FIRST">FIRST</option>
                </select>
              </label>
              <label>
                Sacs
                <input name="bags" value={form.bags} onChange={onChange} type="number" min={0}/>
              </label>
            </div>

            <label>
              <input
                type="checkbox"
                name="direct_only"
                checked={form.direct_only}
                onChange={onChange}
              /> Vols directs uniquement
            </label>
          </>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Envoi..." : `Créer la surveillance (${productType})`}
        </button>
      </form>

      <hr style={{margin:"24px 0"}} />

      <div style={{display:"flex", gap:12}}>
        <button onClick={runCheck} disabled={loading}>Lancer un check (simulation)</button>
      </div>

      {msg && <p style={{marginTop:16}}>{msg}</p>}
    </div>
  );
}
