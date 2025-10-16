import { NextResponse } from "next/server";

export async function GET() {
  const hasUrl  = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSrv  = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSys  = !!process.env.SUPABASE_SYSTEM_USER_ID;
  if (hasUrl && hasAnon && hasSrv && hasSys) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: false, missing: {
    NEXT_PUBLIC_SUPABASE_URL: !hasUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !hasAnon,
    SUPABASE_SERVICE_ROLE_KEY: !hasSrv,
    SUPABASE_SYSTEM_USER_ID: !hasSys
  }}, { status: 500 });
}
