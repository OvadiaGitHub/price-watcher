// app/api/bookings/[id]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// bornes de sécurité (mêmes min que sur la page)
const MIN_ABS = 5;
const MIN_PCT = 0.03;

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await req.json();

    const patch: Record<string, any> = {};
    if (typeof body.active === "boolean") patch.active = body.active;

    if (body.threshold_abs != null) {
      const v = Math.max(Number(body.threshold_abs), MIN_ABS);
      patch.threshold_abs = v;
    }
    if (body.threshold_pct != null) {
      const v = Math.max(Number(body.threshold_pct), MIN_PCT);
      patch.threshold_pct = v;
    }
    if (body.check_interval_minutes != null) {
      const v = Math.max(5, Number(body.check_interval_minutes)); // min 5 min
      patch.check_interval_minutes = v;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, booking: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// (optionnel) GET pour récupérer un suivi précis
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", params.id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ ok: true, booking: data });
}
