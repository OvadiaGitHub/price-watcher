import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MIN_RECHECK_SECONDS = 30;
const isProd = !!process.env.VERCEL; // vrai sur Vercel

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function GET(req: Request) {
  // --- Auth cron (skip en local) ---
  if (isProd && process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      // On autorise tout de même le recheck manuel ciblé depuis l’UI (id présent) ?
      // Si tu veux *forcer* le secret pour *tous* les appels, supprime ce bloc "id".
      const url = new URL(req.url);
      const hasManualId = !!url.searchParams.get("id");
      if (!hasManualId) return unauthorized();
    }
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id"); // recheck ciblé (facultatif)

    // anti-spam recheck ciblé
    if (id) {
      const { data: last, error: e0 } = await supabaseAdmin
        .from("checks")
        .select("checked_at")
        .eq("booking_id", id)
        .order("checked_at", { ascending: false })
        .limit(1);
      if (e0) throw e0;
      if (last && last[0]?.checked_at) {
        const lastTs = new Date(last[0].checked_at).getTime();
        if ((Date.now() - lastTs) / 1000 < MIN_RECHECK_SECONDS) {
          const wait = Math.ceil(MIN_RECHECK_SECONDS - (Date.now() - lastTs) / 1000);
          return NextResponse.json({ ok: false, error: `Trop fréquent. Réessaie dans ~${wait}s.` }, { status: 429 });
        }
      }
    }

    // choisir le booking (id ciblé ou prochain à échéance)
    let query = supabaseAdmin.from("bookings").select("*").eq("active", true);
    if (id) {
      query = query.eq("id", id).limit(1);
    } else {
      query = query.lte("next_check_at", new Date().toISOString())
                   .order("next_check_at", { ascending: true })
                   .limit(1);
    }
    const { data: toCheck, error: e1 } = await query;
    if (e1) throw e1;
    if (!toCheck || toCheck.length === 0) {
      return NextResponse.json({ ok: true, message: "Aucune réservation à checker maintenant." });
    }

    const b = toCheck[0];

    // --- SIMULATION de prix (à remplacer par provider réel) ---
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const drop = clamp(Math.round((Math.random() * 25) + 5), 5, 30);
    const price_found = Math.max(1, Number(b.price_paid) - drop);
    const currency_found = b.currency_paid || "EUR";

    const started = Date.now();
    const { error: e2 } = await supabaseAdmin.from("checks").insert({
      booking_id: b.id,
      price_found,
      currency_found,
      status: "ok",
      run_ms: Date.now() - started,
      meta: { note: id ? "manual-recheck" : "scheduler", provider: "simulation" }
    });
    if (e2) throw e2;

    // ... après l'insert dans checks (e2), calcule l’alerte :
let shouldAlert = false;
let deltaAbs = null as number | null;
let deltaPct = null as number | null;

deltaAbs = Number(b.price_paid) - Number(price_found);
if (b.price_paid > 0) deltaPct = deltaAbs / Number(b.price_paid);

if (b.threshold_abs != null && deltaAbs >= Number(b.threshold_abs)) shouldAlert = true;
if (!shouldAlert && b.threshold_pct != null && deltaPct != null && deltaPct >= Number(b.threshold_pct)) {
  shouldAlert = true;
}

if (shouldAlert) {
  // 1) Log en base
  const { error: e3 } = await supabaseAdmin.from("alerts").insert({
    booking_id: b.id,
    check_id: undefined,        // optionnel si tu veux relier au check: il faut récupérer l’id du check inséré via .select() plus haut
    delta_abs: deltaAbs!,
    delta_pct: deltaPct!,
    channel: "email"
  });
  if (e3) console.error("alerts.insert error", e3);

  // 2) Envoi e-mail
  const to = process.env.ALERTS_TO_DEFAULT!;
  const subject = `💸 Économie possible: ${Math.round(deltaAbs!)}€`;
  const deeplink = (b.url as string) || ""; // pour l’instant, on met le même lien (Hôtel). Pour Vols, on mettra le deeplink provider.
  const lines = [
    `<h2>Bonne nouvelle 🎉</h2>`,
    `<p>Réservation <strong>${b.origin_iata ? "Vol" : "Hôtel"}</strong> : on peut gagner ~<strong>${Math.round(deltaAbs!)}€</strong>`,
    deltaPct != null ? ` (~${Math.round(deltaPct!*100)}%)` : "",
    `.</p>`,
    `<ul>`,
    b.origin_iata ? `<li>${b.origin_iata} → ${b.destination_iata} le ${b.departure_date ?? "?"}</li>` : "",
    !b.origin_iata && b.url ? `<li><a href="${deeplink}" target="_blank">Lien réservation</a></li>` : "",
    `<li>Prix payé : ${b.price_paid} ${b.currency_paid}</li>`,
    `<li>Prix trouvé : ${price_found} ${currency_found}</li>`,
    `</ul>`,
    deeplink ? `<p><a href="${deeplink}" target="_blank" style="display:inline-block;padding:10px 14px;background:#0a7;color:#fff;border-radius:8px;text-decoration:none">Rebook maintenant</a></p>` : "",
    `<p style="color:#666">Seuils: €≥${b.threshold_abs ?? "—"}, %≥${b.threshold_pct != null ? Math.round(b.threshold_pct*100)+"%" : "—"}</p>`
  ].join("");

  // Appel interne (server → server)
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/alerts/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, html: lines })
  }).catch((e) => console.error("send alert email error", e));
}

return NextResponse.json({
  ok: true,
  message: `Check booking ${b.id}. Prix simulé: ${price_found} ${currency_found}. Alerte: ${shouldAlert ? "OUI" : "non"}.`
});
