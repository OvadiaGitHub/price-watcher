// ...imports identiques
const MIN_RECHECK_SECONDS = 30;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id"); // booking ciblé (optionnel)

    // Si recheck ciblé, bloque si le dernier check est trop récent
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
        const nowTs = Date.now();
        if ((nowTs - lastTs) / 1000 < MIN_RECHECK_SECONDS) {
          const wait = Math.ceil(MIN_RECHECK_SECONDS - (nowTs - lastTs) / 1000);
          return NextResponse.json(
            { ok: false, error: `Trop fréquent. Réessaie dans ~${wait}s.` },
            { status: 429 }
          );
        }
      }
    }

    // --- suite inchangée : choisir le booking à checker (avec id ou par next_check_at) ---
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

    // Simulation de prix (identique)
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
      message: `Check fait pour booking ${b.id}. Prix simulé: ${price_found} ${currency_found}. Alerte: ${shouldAlert ? "OUI" : "non"}.`
    });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
