"use client";

import { useState } from "react";

export default function HomePage() {
  const [form, setForm] = useState({
    url: "",
    price_paid: "",
    currency_paid: "EUR",
    checkin: "",
    checkout: "",
    threshold_abs: "",
    threshold_pct: ""
  });

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      // construit le body minimal requis par ton /api/bookings
      const body: any = {
        url: form.url,
        price_paid: Number(form.price_paid),
        currency_paid: form.currency_paid.toUpperCase(),
      };
      if (form.checkin) body.checkin = form.checkin;
      if (form.checkout) body.checkout = form.checkout;
      if (form.threshold_abs) body.threshold_abs = Number(form.threshold_abs);
      if (form.threshold_pct) body.threshold_pct = Number(form.threshold_pct);

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur inconnue");

      setMsg(`✅ Réservation enregistrée (id: ${json.booking?.id ?? "?"})`);
      setForm({
        url: "",
        price_paid: "",
        currency_paid: "EUR",
        checkin: "",
        checkout: "",
        threshold_abs: "",
        threshold_pct: ""
      });
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
      setMsg(`🔎 Check: ${json.message}`);
    } catch (e:any) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth: 720, margin: "40px auto", padding: 20}}>
      <h1>Price Watcher — MVP</h1>
      <p>Crée une surveillance de prix (ex: URL Booking.com + prix payé + seuils).</p>

      <form onSubmit={onSubmit} style={{display:"grid", gap:12, marginTop: 20}}>
        <label>
          URL de réservation *
          <input
            name="url"
            value={form.url}
            onChange={onChange}
            placeholder="https://www.booking.com/..."
            required
            style={{width:"100%"}}
          />
        </label>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
          <label>
            Prix payé (nombre) *
            <input name="price_paid" value={form.price_paid} onChange={onChange} required type="number" step="0.01"/>
          </label>
          <label>
            Devise *
            <input name="currency_paid" value={form.currency_paid} onChange={onChange} required/>
          </label>
          <label>
            Seuil € (optionnel)
            <input name="threshold_abs" value={form.threshold_abs} onChange={onChange} type="number" step="0.01"/>
          </label>
        </div>

        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12}}>
          <label>
            Seuil % (0.05 = 5%)
            <input name="threshold_pct" value={form.threshold_pct} onChange={onChange} type="number" step="0.0001"/>
          </label>
          <label>
            Check-in (yyyy-mm-dd)
            <input name="checkin" value={form.checkin} onChange={onChange} placeholder="2026-02-10"/>
          </label>
          <label>
            Check-out (yyyy-mm-dd)
            <input name="checkout" value={form.checkout} onChange={onChange} placeholder="2026-02-12"/>
          </label>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Envoi..." : "Créer la surveillance"}
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
