"use client";

import { useState } from "react";

type ProductType = "hotel" | "flight";

export default function HomePage() {
  const [productType, setProductType] = useState<ProductType>("hotel");

  // état commun + spécifiques selon le type
  const [form, setForm] = useState({
    // commun
    price_paid: "",
    currency_paid: "EUR",
    threshold_abs: "",
    threshold_pct: "",

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
    direct_only: false,
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as any;
    if (type === "checkbox") {
      setForm((f) => ({ ...f, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      // corps minimal requis (toujours)
      const body: any = {
        price_paid: Number(form.price_paid),
        currency_paid: form.currency_paid.toUpperCase(),
      };

      // seuils optionnels
      if (form.threshold_abs) body.threshold_abs = Number(form.threshold_abs);
      if (form.threshold_pct) body.threshold_pct = Number(form.threshold_pct);

      if (productType === "hotel") {
        // Hôtel : URL + dates (si tu les as)
        body.url = form.url;
        if (!body.url) throw new Error("URL (hôtel) requise");
        if (form.checkin) body.checkin = form.checkin;
        if (form.checkout) body.checkout = form.checkout;
      } else {
        // Vol : colonnes vol (si elles existent dans ta base — on les a ajoutées)
        // (URL reste optionnelle; tu peux l'utiliser pour stocker une page de résa)
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

      // reset partiel selon le type
      setForm((f) => ({
        ...f,
        price_paid: "",
        currency_paid: "EUR",
        threshold_abs: "",
        threshold_pct: "",
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

  return (
    <div style={{maxWidth: 820, margin: "40px auto", padding: 20}}>
      <h1>Price Watcher — MVP</h1>
      <p>Suivi de prix d’une réservation modifiable/annulable.</p>
<div style={{padding:"10px 16px", background:"#f8f8f8", borderBottom:"1px solid #eee"}}>
  <a href="/" style={{marginRight:12, textDecoration:"none"}}>Accueil</a>
  <a href="/mes-suivis" style={{textDecoration:"none"}}>Mes suivis</a>
</div>

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

      <form onSubmit={onSubmit} style={{display:"grid", gap:12, marginTop: 20}}>

        {/* Champs communs */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 120px 120px 120px", gap:12}}>
          <label>
            Prix payé (€) *
            <input name="price_paid" value={form.price_paid} onChange={onChange} required type="number" step="0.01"/>
          </label>
          <label>
            Devise *
            <input name="currency_paid" value={form.currency_paid} onChange={onChange} required />
          </label>
          <label>
            Seuil € (opt.)
            <input name="threshold_abs" value={form.threshold_abs} onChange={onChange} type="number" step="0.01"/>
          </label>
          <label>
            Seuil % (opt.)
            <input name="threshold_pct" value={form.threshold_pct} onChange={onChange} type="number" step="0.0001" placeholder="0.05 = 5%"/>
          </label>
        </div>

        {/* Section HOTEL */}
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
                Check-in (yyyy-mm-dd)
                <input name="checkin" value={form.checkin} onChange={onChange} placeholder="2026-02-10"/>
              </label>
              <label>
                Check-out (yyyy-mm-dd)
                <input name="checkout" value={form.checkout} onChange={onChange} placeholder="2026-02-12"/>
              </label>
            </div>
          </>
        )}

        {/* Section VOL */}
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
                Départ (yyyy-mm-dd) *
                <input name="departure_date" value={form.departure_date} onChange={onChange} placeholder="2026-03-01" required />
              </label>
              <label>
                Retour (yyyy-mm-dd)
                <input name="return_date" value={form.return_date} onChange={onChange} placeholder="(optionnel si aller simple)"/>
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
