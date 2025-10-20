"use client";
import { useState } from "react";

export function Actions({ id, active }: { id: string; active: boolean }) {
  const [loading, setLoading] = useState<"stop" | "recheck" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  async function stop() {
    try {
      setLoading("stop");
      const res = await fetch(`/api/bookings/${id}/deactivate`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      showToast("Suivi stoppé");
      // petit délai pour laisser voir le toast
      setTimeout(() => location.reload(), 600);
    } catch (e:any) {
      showToast(`Erreur stop: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  async function recheck() {
    try {
      setLoading("recheck");
      const res = await fetch(`/api/checks/run?id=${id}`);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || res.statusText);
      showToast("Recheck lancé");
      setTimeout(() => location.reload(), 600);
    } catch (e:any) {
      showToast(`Erreur recheck: ${e.message}`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", position: "relative" }}>
      <button onClick={recheck} disabled={loading !== null} title="Lancer un check maintenant">
        {loading === "recheck" ? "⏳ Recheck..." : "🔁 Rechecker"}
      </button>
      <button onClick={stop} disabled={!active || loading !== null} title="Stopper le suivi">
        {loading === "stop" ? "⏳ Stop..." : "🛑 Stopper"}
      </button>

      {toast && (
        <div
          style={{
            position: "absolute",
            top: -36,
            left: 0,
            background: "#333",
            color: "white",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 4px 10px rgba(0,0,0,0.15)"
          }}
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
