"use client";

export function Actions({ id, active }: { id: string; active: boolean }) {
  async function stop() {
    const res = await fetch(`/api/bookings/${id}/deactivate`, { method: "POST" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert("Erreur stop: " + (j.error || res.statusText));
      return;
    }
    location.reload();
  }

  async function recheck() {
    const res = await fetch(`/api/checks/run?id=${id}`);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert("Erreur recheck: " + (j.error || res.statusText));
      return;
    }
    location.reload();
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={recheck} title="Lancer un check maintenant">🔁 Rechecker</button>
      <button onClick={stop} disabled={!active} title="Stopper le suivi">
        🛑 Stopper
      </button>
    </div>
  );
}
