// app/api/bookings/[id]/deactivate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const userId = process.env.SUPABASE_SYSTEM_USER_ID!;
    const { error } = await s
      .from("bookings")
      .update({ active: false })
      .eq("id", params.id)
      .eq("user_id", userId); // sécurité MVP

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
