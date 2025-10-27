"use client";
import { useState } from "react";

export function Actions({ id, active }: { id: string; active: boolean }) {
  const [loading, setLoading] = useState<"stop"|"start"|"recheck"|"edit"|"open"|null>(null);
  const [toast, setToast] = useState<string | null>(null);
  function notify(t: string){ setToast(t); setTimeout(()=>setToast(null), 1800); }

  async function recheck() {
    try {
      setLoading("recheck");
      const r = await fetch(`/api/checks/run?id=${id}`);
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Erreur recheck");
      notify(j.message || "OK");
    } catch(e:any){ notify("❌ "+e.message); }
    finally{ setLoading(null); }
  }

  async function stop() {
    try {
      setLoading("stop");
      const r = await fetch(`/api/bookings/${id}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ active: false })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Erreur stop");
      notify("🛑 Suivi stoppé");
    } catch(e:any){ notify("❌ "+e.message); }
    finally{ setLoading(null); }
  }

  async function start() {
    try {
      setLoading("start");
      const r = await fetch(`/api/bookings/${id}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ active: true })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Erreur start");
      notify("▶️ Suivi relancé");
    } catch(e:any){ notify("❌ "+e.message); }
    finally{ setLoading(null); }
  }

  async function editThresholds() {
    try {
      setLoading("edit");
      const abs = prompt("Nouveau seuil € (min 5) :", "10");
      if (abs===null) return;
      const pct = prompt("Nouveau seuil % (min 3%) :", "5");
      if (pct===null) return;

      const absNum = Number(abs);
      const pctNum = Number(pct)/100; // on stocke en 0.05

      const r = await fetch(`/api/bookings/${id}`, {
        method:"PATCH",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ threshold_abs: absNum, threshold_pct: pctNum })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j.error||"Erreur édition");
      notify("✎ Seuils mis à jour");
    } catch(e:any){ notify("❌ "+e.message); }
    finally{ setLoading(null); }
  }

  // (déjà présent) open deeplink si tu l’avais ajouté avant
  async function openDeeplink() {
    try {
      setLoading("open");
      const res = await fetch(`/api/deeplink/preview?id=${id}`);
      const j = await res.json();
      if (!res.ok || !j.deeplink) throw new Error(j.error || "deeplink indisponible");
      window.open(j.deeplink, "_blank");
      notify("🔗 Ouvert");
    } catch (e:any){ notify("❌ "+e.message); }
    finally{ setLoading(null); }
  }

  return (
    <div style={{ display:"flex", gap:8, alignItems:"center", position:"relative" }}>
      <button onClick={openDeeplink} disabled={loading!==null}>🔗 Rebook</button>
      <button onClick={recheck} disabled={loading!==null}>🔁 Rechecker</button>
      <button onClick={editThresholds} disabled={loading!==null}>✎ Éditer seuils</button>
      {active
        ? <button onClick={stop}  disabled={loading!==null}>🛑 Stop</button>
        : <button onClick={start} disabled={loading!==null}>▶️ Start</button>
      }
      {toast && (
        <div style={{ position:"absolute", top:-36, left:0, background:"#333", color:"#fff",
                      padding:"6px 10px", borderRadius:8, fontSize:12 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
