import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const d = (x: any) => (x ? new Date(String(x)) : null);

export async function GET() {
  // pour éviter 405 si tu ouvres l'URL dans le navigateur
  return NextResponse.json({
    ok: true,
    usage: "POST JSON to create a booking",
    required: ["url", "price_paid", "currency_paid"]
  });
}

export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.url)               return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (b.price_paid == null) return NextResponse.json({ error: "price_paid is required" }, { status: 400 });
    if (!b.currency_paid)     return NextResponse.json({ error: "currency_paid is required" }, { status: 400 });

    const userId = process.env.SUPABASE_SYSTEM_USER_ID;
    if (!userId) return NextResponse.json({ error: "Missing SUPABASE_SYSTEM_USER_ID" }, { status: 500 });

    const row = {
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
      next_check_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin.from("bookings").insert(row).select();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, booking: data?.[0] ?? null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
