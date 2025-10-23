// app/api/alerts/send/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const { to, subject, html, text } = await req.json();
    if (!to) return NextResponse.json({ ok:false, error:"missing 'to'" }, { status:400 });
    const { error } = await resend.emails.send({
      from: process.env.ALERTS_FROM!,
      to: Array.isArray(to) ? to : [to],
      subject: subject || "Alerte prix",
      html: html || (text ? `<pre>${text}</pre>` : "<p>(vide)</p>")
    });
    if (error) throw error;
    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:500 });
  }
}
