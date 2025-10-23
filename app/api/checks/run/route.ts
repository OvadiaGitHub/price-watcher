// app/api/checks/run/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// config
const MIN_RECHECK_SECONDS = 30;
const isProd = !!process.env.VERCEL;

// helpers
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const unauthorized = () => NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  // --- Auth cron (en prod) ---
  if (isProd && process.env.CRON_SECRET) {
    const url = new URL(req.url);
    const hasManualId = !!url.searchParams.get("id"); // autorise recheck manuel UI
    const auth = req.headers.get("authorization") || "";
    const okHeader = auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!okHeader && !hasManualId) return unauthorized();
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id"); // recheck ciblé (facultatif)

    // Anti-spam recheck manuel
    if (id) {
      const { data: last, error: e0 } = await supabaseAdmin
        .from("checks")
        .select("checked_at")
        .eq("booking_id", id)
        .order("checked_at", { ascending: false })
        .limit(1);
      if (e0) throw e0;

      if (last && last[0]?.checked_at) {
        const lastTs = new Date(last[0].checked_at as string).getTime();
        const delta = (Date.now() - lastTs) / 1000;
        if (delta < MIN_RECHECK_SECONDS) {
          const wait = Math.ceil(MIN_RECHECK_SECONDS - delta);
          return NextResponse.json({ ok: false, error: `Trop fréquent. Réessaie dans ~${wait}s.` }, { status: 429 });
        }
      }
    }

    // Choisir le booking à checker
    let query = supabaseAdmin.from("bookings").select("*").eq("active", true);
    if (id) {
      query = query.eq("id", id).limit(1);
    } else {
      query = query
        .lte("next_check_at", new Date().toISOString())
        .order("next_check_at", { ascending: true })
        .limit(1);
    }

    const { data: toCheck, error: e1 } = await query;
    if (e1) throw e1;
    if (!toCheck || toCheck.length === 0) {
      return NextResponse.json({ ok: true, message: "Aucune réservation à checker maintenant." });
    }

    const b = toCheck[0];

    // --- SIMULATION du prix trouvé (remplacé plus tard par un provider réel) ---
    const drop = clamp(Math.round(Math.random() * 25 + 5), 5, 30);
    const price_found = Math.max(1, Number(b.price_paid) - drop);
    const currency_found = (b as any).currency_paid || "EUR";

    // Écrire dans checks ET récupérer l'id du check
    const started = Date.now();
    const { data: newCheck, error: e2 } = await supabaseAdmin
      .from("checks")
      .insert({
        booking_id: (b as any).id,
        price_found,
        currency_found,
        status: "ok",
        run_ms: Date.now() - started,
        meta: { note: id ? "manual-recheck" : "scheduler", provider: "simulation" }
      })
      .select("*")
      .single();
    if (e2) throw e2;

    // Déterminer si alerte
    const deltaAbs = Number(b.price_paid) - price_found;
    const deltaPct = Number(b.price_paid) > 0 ? deltaAbs / Number(b.price_paid) : null;
    let shouldAlert = false;
    if ((b as any).threshold_abs != null && deltaAbs >= Number((b as any).threshold_abs)) shouldAlert = true;
    if (!shouldAlert && (b as any).threshold_pct != null && deltaPct != null) {
      if (deltaPct >= Number((b as any).threshold_pct)) shouldAlert = true;
    }

    // Si alerte: insérer dans alerts (+ email optionnel)
    if (shouldAlert) {
      const { error: e3 } = await supabaseAdmin.from("alerts").insert({
        booking_id: (b as any).id,
        check_id: newCheck.id,
        delta_abs: deltaAbs,
        delta_pct: deltaPct ?? 0,
        channel: "email" // ou "push" plus tard
      });
      if (e3) console.error("alerts.insert error", e3);

      // (Optionnel) déclencher un e-mail si tu as créé /api/alerts/send
      // await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/alerts/send`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({
      //     to: process.env.ALERTS_TO_DEFAULT!,
      //     subject: `💸 Économie possible: ~${Math.round(deltaAbs)}€`,
      //     html: `<p>Prix payé: ${b.price_paid} ${b.currency_paid}<br/>Prix trouvé: ${price_found} ${currency_found}</p>`
      //   })
      // }).catch((e) => console.error("send alert email error", e));
    }

    return NextResponse.json({
      ok: true,
      message: `Check booking ${(b as any).id}. Prix simulé: ${price_found} ${currency_found}. Alerte: ${shouldAlert ? "OUI" : "non"}.`
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
