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

    let shouldAlert = false;
    if (b.threshold_abs != null && price_found <= Number(b.price_paid) - Number(b.threshold_abs)) shouldAlert = true;
    if (!shouldAlert && b.threshold_pct != null && b.price_paid > 0) {
      const deltaPct = (Number(b.price_paid) - price_found) / Number(b.price_paid);
      if (deltaPct >= Number(b.threshold_pct)) shouldAlert = true;
    }

    return NextResponse.json({
      ok: true,
      message: `Check booking ${b.id}. Prix simulé: ${price_found} ${currency_found}. Alerte: ${shouldAlert ? "OUI" : "non"}.`
    });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
