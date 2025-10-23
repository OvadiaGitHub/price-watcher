// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Client Supabase côté serveur (Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// util date: "YYYY-MM-DD" -> Date | null
const d = (x: any) => (x ? new Date(String(x)) : null);

// minimums de seuils (sécurité serveur)
const THRESH_MIN_ABS = 5;      // € min
const THRESH_MIN_PCT = 0.03;   // 3% min

export async function GET() {
  return NextResponse.json({
    ok: true,
    usage: "POST JSON to /api/bookings to create a booking",
    hotel_required: ["url", "price_paid", "currency_paid"],
    flight_required: ["origin_iata", "destination_iata", "departure_date", "price_paid", "currency_paid"],
    optional: [
      "checkin","checkout","threshold_abs","threshold_pct","check_interval_minutes",
      "return_date","adults","children","infants","cabin","bags","direct_only"
    ]
  });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();

    // Détecte si c'est un VOL (présence de champs vol)
    const isFlight = !!(b.origin_iata || b.destination_iata || b.departure_date || b.return_date);

    // Validations communes
    if (b.price_paid == null) {
      return NextResponse.json({ error: "price_paid is required" }, { status: 400 });
    }
    if (!b.currency_paid) {
      return NextResponse.json({ error: "currency_paid is required" }, { status: 400 });
    }

    // Validations spécifiques
    if (isFlight) {
      if (!b.origin_iata)      return NextResponse.json({ error: "origin_iata is required for flight" }, { status: 400 });
      if (!b.destination_iata) return NextResponse.json({ error: "destination_iata is required for flight" }, { status: 400 });
      if (!b.departure_date)   return NextResponse.json({ error: "departure_date is required for flight" }, { status: 400 });
    } else {
      // Hôtel : URL requise
      if (!b.url) return NextResponse.json({ error: "url is required for hotel" }, { status: 400 });
    }

    // User "système" (MVP sans authent)
    const userId = process.env.SUPABASE_SYSTEM_USER_ID;
    if (!userId) {
      return NextResponse.json({ error: "Missing SUPABASE_SYSTEM_USER_ID env" }, { status: 500 });
    }

    // Candidat à insérer
    const candidate: Record<string, any> = {
      user_id: userId,

      // Hôtel
      url: b.url ? String(b.url) : null,
      checkin: d(b.checkin),
      checkout: d(b.checkout),

      // Commun
      price_paid: Number(b.price_paid),
      currency_paid: String(b.currency_paid).toUpperCase(),
      threshold_abs: b.threshold_abs != null ? Number(b.threshold_abs) : null,
      threshold_pct: b.threshold_pct != null ? Number(b.threshold_pct) : null,
      active: true,
      check_interval_minutes: b.check_interval_minutes ?? 360,
      next_check_at: new Date().toISOString(),

      // Vol (si colonnes créées en base)
      origin_iata: b.origin_iata ? String(b.origin_iata).trim().toUpperCase() : null,
      destination_iata: b.destination_iata ? String(b.destination_iata).trim().toUpperCase() : null,
      departure_date: d(b.departure_date),
      return_date: d(b.return_date),
      adults: b.adults != null ? Number(b.adults) : 1,
      children: b.children != null ? Number(b.children) : 0,
      infants: b.infants != null ? Number(b.infants) : 0,
      cabin: b.cabin || "ECONOMY",
      bags: b.bags != null ? Number(b.bags) : 0,
      direct_only: !!b.direct_only,
    };

    // Clamp des seuils (sécurité serveur)
    if (candidate.threshold_abs != null) {
      candidate.threshold_abs = Math.max(THRESH_MIN_ABS, Number(candidate.threshold_abs));
    }
    if (candidate.threshold_pct != null) {
      candidate.threshold_pct = Math.max(THRESH_MIN_PCT, Number(candidate.threshold_pct));
    }

    // Colonnes autorisées (doivent exister en base)
    const allowed = new Set([
      // hôtel / commun
      "user_id","url","checkin","checkout","price_paid","currency_paid",
      "threshold_abs","threshold_pct","active","check_interval_minutes","next_check_at",
      // vol
      "origin_iata","destination_iata","departure_date","return_date",
      "adults","children","infants","cabin","bags","direct_only"
    ]);

    // Filtre: ne garder que les clés autorisées
    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(candidate)) {
      if (allowed.has(k) && v !== undefined) row[k] = v;
    }

    // Insert + retour de la ligne
    const { data, error } = await supabaseAdmin.from("bookings").insert(row).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, booking: data?.[0] ?? null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
