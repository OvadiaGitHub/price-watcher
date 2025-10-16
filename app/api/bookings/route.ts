import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ serveur only (bypass RLS)
);

// util: parse date "YYYY-MM-DD" ou null
const d = (x: any) => (x ? new Date(String(x)) : null);

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // requis par TON schéma
    if (!body.url)           return NextResponse.json({ error: "url is required" }, { status: 400 });
    if (body.price_paid == null) return NextResponse.json({ error: "price_paid is required" }, { status: 400 });
    if (!body.currency_paid) return NextResponse.json({ error: "currency_paid is required" }, { status: 400 });

    const userId = process.env.SUPABASE_SYSTEM_USER_ID; // Option A
    if (!userId) {
      return NextResponse.json({ error: "Missing SUPABASE_SYSTEM_USER_ID server env" }, { status: 500 });
    }

    const row = {
      user_id: userId,
      url: String(body.url),
      // dates optionnelles détectées en amont (tu peux les laisser null)
      checkin: body.checkin ? d(body.checkin) : null,
      checkout: body.checkout ? d(body.checkout) : null,

      price_paid: Number(body.price_paid),
      currency_paid: String(body.currency_paid).toUpperCase(),

      threshold_abs: body.threshold_abs != null ? Number(body.threshold_abs) : null,
      threshold_pct: body.threshold_pct != null ? Number(body.threshold_pct) : null,

      // orchestration de base
      active: true,
      check_interval_minutes: body.check_interval_minutes ?? 360,
      next_check_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .insert(row)
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, booking: data?.[0] ?? null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
