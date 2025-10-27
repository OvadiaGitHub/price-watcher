import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildHotelDeeplink } from "../../../../lib/deeplinks";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    const deeplink = buildHotelDeeplink(data);
    return NextResponse.json({ ok: true, deeplink });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
