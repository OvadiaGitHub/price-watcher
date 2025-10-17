// app/mes-suivis/page.tsx
import { Actions } from "./Actions";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

// mêmes minimums que côté client/serveur
const MIN = { abs: 5, pct: 0.03 };

async function getRows() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const userId = process.env.SUPABASE_SYSTEM_USER_ID!;
  const { data, error } = await supabase
    .from("booking_latest")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

function fmtMoney(n: any, ccy: string | null) {
  if (n == null) return "—";
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return `${v.toFixed(2)} ${ccy || ""}`.trim();
}
function pct(n: any) {
  if (n == null) return "—";
  const v = Number(n);
  if (!isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
function badge(text: string, tone: "ok" | "warn" | "muted" = "muted") {
  const bg = tone === "ok" ? "#e6ffed" : tone === "warn" ? "#fff4e5" : "#f5f5f5";
  const fg = tone === "ok" ? "#066a2b" : tone === "warn" ? "#8a4b00" : "#444";
  return (
    <span
      style={{
        background: bg, color: fg, padding: "2px 8px", borderRadius: 999,
        fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export default async function MesSuivisPage() {
  const rows = await getRows();

  return (
    <div style={{ maxWidth: 1040, margin: "40px auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Mes suivis</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/" style={{ textDecoration: "none" }}>➕ Nouvelle surveillance</Link>
          <a href="/mes-suivis">🔄 Rafraîchir</a>
        </div>
      </div>

      <p style={{ color: "#666" }}>
        Liste de vos réservations suivies, avec le dernier prix observé (vue <code>booking_latest</code>).
      </p>

      {rows.length === 0 ? (
        <p>Aucun suivi pour le moment.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 10 }}>Type</th>
                <th style={{ padding: 10 }}>Réservation</th>
                <th style={{ padding: 10 }}>Prix payé</th>
                <th style={{ padding: 10 }}>Dernier prix</th>
                <th style={{ padding: 10 }}>Δ €</th>
                <th style={{ padding: 10 }}>Δ %</th>
                <th style={{ padding: 10 }}>Seuils</th>
                <th style={{ padding: 10 }}>Statut</th>
                <th style={{ padding: 10 }}>Dernier check</th>
                <th style={{ padding: 10 }}>Prochain check</th>
                <th style={{ padding: 10 }}>Prochain check</th>
                <th style={{ padding: 10 }}>Actions</th>

              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const productType =
                  r.origin_iata || r.destination_iata || r.departure_date ? "Vol" : "Hôtel";

                const deltaOkAbs =
                  r.threshold_abs != null &&
                  r.price_found != null &&
                  Number(r.price_paid) - Number(r.price_found) >= Number(r.threshold_abs);

                const deltaOkPct =
                  r.threshold_pct != null &&
                  r.price_found != null &&
                  Number(r.price_paid) > 0 &&
                  (Number(r.price_paid) - Number(r.price_found)) / Number(r.price_paid) >= Number(r.threshold_pct);

                const shouldAlert = !!(deltaOkAbs || deltaOkPct);

                const thresholdAbsBadge = r.threshold_abs != null
                  ? `${Number(r.threshold_abs).toFixed(0)}€${Number(r.threshold_abs) === MIN.abs ? " (min)" : ""}`
                  : "—";

                const thresholdPctBadge = r.threshold_pct != null
                  ? `${(Number(r.threshold_pct) * 100).toFixed(0)}%${Number(r.threshold_pct) === MIN.pct ? " (min)" : ""}`
                  : "—";

                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 10 }}>
                      {badge(productType, productType === "Vol" ? "muted" : "ok")}
                    </td>
                    <td style={{ padding: 10, maxWidth: 320 }}>
                      {productType === "Hôtel" && r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer">
                          Lien réservation
                        </a>
                      ) : (
                        <>
                          {r.origin_iata || "—"} → {r.destination_iata || "—"}
                          <div style={{ color: "#666", fontSize: 12 }}>
                            {r.departure_date || "—"}
                            {r.return_date ? ` · retour ${r.return_date}` : ""}
                          </div>
                        </>
                      )}
                      <div style={{ color: "#666", fontSize: 12 }}>
                        Créé le {new Date(r.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: 10 }}>{fmtMoney(r.price_paid, r.currency_paid)}</td>
                    <td style={{ padding: 10 }}>{fmtMoney(r.price_found, r.currency_found)}</td>
                    <td style={{ padding: 10 }}>
                      {r.delta_abs == null ? "—" : fmtMoney(r.delta_abs, r.currency_paid)}
                    </td>
                    <td style={{ padding: 10 }}>{pct(r.delta_pct)}</td>
                    <td style={{ padding: 10, whiteSpace: "nowrap" }}>
                      {badge(`€≥${thresholdAbsBadge}`, "muted")}{" "}
                      {badge(`%≥${thresholdPctBadge}`, "muted")}
                    </td>
                    <td style={{ padding: 10 }}>
                      {shouldAlert ? badge("ALERTE", "warn") : badge(r.last_status || "—", "muted")}
                    </td>
                    <td style={{ padding: 10 }}>
                      {r.last_checked_at ? new Date(r.last_checked_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: 10 }}>
                      {r.next_check_at ? new Date(r.next_check_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: 10 }}>
                       <Actions id={r.id} active={!!r.active} />
                     </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <a href="/api/checks/run">🔎 Lancer un check (simulation)</a>
      </div>
    </div>
  );
}
