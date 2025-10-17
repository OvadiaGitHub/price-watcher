// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Client Supabase côté serveur (utilise la Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// petit util : transforme une date "YYYY-MM-DD" en Date JS ou null
const d = (x: any) => (x ? new Date(String(x)) : null);

// GET : juste pour ne pas avoir d'erreur si tu ouvres l'URL dans le navigateur
export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST JSON to /api/bookings to create a booking",
    required: ["url", "price_paid", "currency_paid"],
    optional: ["checkin", "checkout", "threshold_abs", "threshold_pct", "check_interval_minutes"]
  });
}

// POST : crée une ligne dans la table `bookings`
export async function POST(req: Request) {
  try {
    const b = await req.json();

    // 1) Vérifs simples (les champs minimums)
    if (!b.url)               return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (b.price_paid == null) return NextResponse.json({ error: "price_paid is required" }, { status: 400 });
    if (!b.currency_paid)     return NextResponse.json({ error: "currency_paid is required" }, { status: 400 });

    // 2) On prend l'utilisateur "système" (ton UUID mis dans SUPABASE_SYSTEM_USER_ID)
    const userId = process.env.SUPABASE_SYSTEM_USER_ID;
    if (!userId) return NextResponse.json({ error: "Missing SUPABASE_SYSTEM_USER_ID env" }, { status: 500 });

    // 3) On prépare toutes les valeurs qu'on AIMERAIT mettre en base
    const candidate = {
      user_id: userId,
      url: String(b.url),
      checkin: d(b.checkin),
      checkout: d(b.checkout),
      price_paid: Number(b.price_paid),
      currency_paid: String(b.currency_paid).toUpperCase(),
      threshold_abs: b.threshold_abs != null ? Number(b.threshold_abs) : null,
      threshold_pct: b.threshold_pct != null ? Number(b.threshold_pct) : null,
      active: true,
      check_interval_minutes: b.check_interval_minutes ?? 360,
      next_check_at: new Date().toISOString(),

      // ↓↓↓ NE GARDE CES CHAMPS "VOL" QUE SI TU AS CRÉÉ LES COLONNES EN SQL ↓↓↓
      origin_iata: b.origin_iata?.toUpperCase(),
      destination_iata: b.destination_iata?.toUpperCase(),
      departure_date: d(b.departure_date),
      return_date: d(b.return_date),
      adults: b.adults ?? 1,
      children: b.children ?? 0,
      infants: b.infants ?? 0,
      cabin: b.cabin ?? 'ECONOMY',
      bags: b.bags ?? 0,
      direct_only: !!b.direct_only,
    };

    // 4) Liste des colonnes AUTORISÉES dans TA table `bookings`
    //    Si tu n'as PAS ajouté les colonnes "vol", supprime-les de cette liste.
    const allowed = new Set([
      "user_id","url","checkin","checkout","price_paid","currency_paid",
      "threshold_abs","threshold_pct","active","check_interval_minutes","next_check_at",
      // --- colonnes "vol" (à retirer si non créées) ---
      "origin_iata","destination_iata","departure_date","return_date",
      "adults","children","infants","cabin","bags","direct_only"
    ]);

    // 5) On filtre : on ne garde QUE les clés autorisées (évite l'erreur "colonne inconnue")
    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(candidate)) {
      if (allowed.has(k) && v !== undefined) row[k] = v;
    }

    // 6) On écrit la ligne dans la base
    //    (en SQL, "INSERT" veut dire "créer une nouvelle ligne dans une table")
    const { data, error } = await supabaseAdmin.from("bookings").insert(row).select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, booking: data?.[0] ?? null }, { status: 201 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
