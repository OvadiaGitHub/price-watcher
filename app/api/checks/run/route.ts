import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Petite fonction util pour bornes
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export async function GET() {
  try {
    // 1) Récupérer une réservation à checker (active + échue)
    const { data: toCheck, error: e1 } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("active", true)
      .lte("next_check_at", new Date().toISOString())
      .order("next_check_at", { ascending: true })
      .limit(1);

    if (e1) throw e1;
    if (!toCheck || toCheck.length === 0) {
      return NextResponse.json({ ok: true, message: "Aucune réservation à checker maintenant." });
    }

    const b = toCheck[0];

    // 2) SIMULATION d’un prix trouvé (ex : -5 à -30€ par rapport au prix payé)
    const drop = clamp(Math.round((Math.random() * 25) + 5), 5, 30);
    const price_found = Math.max(1, Number(b.price_paid) - drop);
    const currency_found = b.currency_paid || "EUR";

    // 3) Insérer la ligne dans checks
    const started = Date.now();
    const { error: e2 } = await supabaseAdmin.from("checks").insert({
      booking_id: b.id,
      price_found,
      currency_found,
      status: "ok",
      run_ms: Date.now() - started,
      meta: { note: "simulation" }
    });
    if (e2) throw e2;

    // ⚠️ TON TRIGGER after_check_schedule se charge de mettre à jour next_check_at

    // 4) Calculer si on doit alerter (selon tes seuils)
    let shouldAlert = false;
    if (b.threshold_abs != null && price_found <= Number(b.price_paid) - Number(b.threshold_abs)) {
      shouldAlert = true;
    }
    if (!shouldAlert && b.threshold_pct != null && b.price_paid > 0) {
      const deltaPct = (Number(b.price_paid) - price_found) / Number(b.price_paid);
      if (deltaPct >= Number(b.threshold_pct)) shouldAlert = true;
    }

    // (Plus tard) envoyer email si shouldAlert === true
    return NextResponse.json({
      ok: true,
      message: `Check fait pour booking ${b.id}. Prix simulé: ${price_found} ${currency_found}. Alerte: ${shouldAlert ? "OUI" : "non"}.`
    });

  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
