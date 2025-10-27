import "server-only";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

type PriceAlertParams = {
  to?: string;
  from?: string;
  booking: any;
  price_found: number;
  currency_found: string;
  delta_abs: number;
  delta_pct?: number | null;
  deeplink?: string; // pour l'hôtel: b.url; pour les vols: futur deeplink provider
};

export async function sendPriceAlertEmail({
  to,
  from,
  booking,
  price_found,
  currency_found,
  delta_abs,
  delta_pct,
  deeplink,
}: PriceAlertParams) {
  const TO = to || process.env.ALERTS_TO_DEFAULT!;
  const FROM = from || process.env.ALERTS_FROM!;
  if (!TO || !FROM || !process.env.RESEND_API_KEY) {
    // pas configuré -> on ne casse pas la route; on log
    console.warn("[sendPriceAlertEmail] missing env (TO/FROM/API_KEY), email skipped");
    return { skipped: true };
  }

  const isFlight = !!(booking.origin_iata || booking.destination_iata || booking.departure_date);
  const subject = `💸 Économie possible: ~${Math.round(delta_abs)}€ ${isFlight ? "sur un vol" : "sur un hôtel"}`;

  const pricePaidStr = `${Number(booking.price_paid).toFixed(2)} ${booking.currency_paid}`;
  const priceFoundStr = `${Number(price_found).toFixed(2)} ${currency_found}`;
  const pctStr = delta_pct != null ? ` (~${Math.round(delta_pct * 100)}%)` : "";

  const lines: string[] = [];
  lines.push(`<h2 style="margin:0 0 12px">Bonne nouvelle 🎉</h2>`);
  if (isFlight) {
    lines.push(`<p style="margin:0 0 12px">Vol <strong>${booking.origin_iata} → ${booking.destination_iata}</strong> le <strong>${booking.departure_date ?? "?"}</strong></p>`);
  } else if (booking.url) {
    lines.push(`<p style="margin:0 0 12px">Réservation hôtel</p>`);
  }
  lines.push(`<ul style="margin:0 0 12px; padding-left:18px; line-height:1.6">
    <li>Prix payé : <strong>${pricePaidStr}</strong></li>
    <li>Prix trouvé : <strong>${priceFoundStr}</strong></li>
    <li>Gain estimé : <strong>${Math.round(delta_abs)}€</strong>${pctStr}</li>
    <li>Seuils : €≥${booking.threshold_abs ?? "—"}, %≥${booking.threshold_pct != null ? Math.round(booking.threshold_pct * 100) + "%" : "—"}</li>
  </ul>`);

  if (deeplink || booking.url) {
    const link = deeplink || booking.url;
    lines.push(
      `<p style="margin:16px 0 8px">
        <a href="${link}" target="_blank" rel="noreferrer"
           style="display:inline-block;padding:10px 14px;background:#0a7;color:#fff;border-radius:8px;text-decoration:none">
          Rebook maintenant
        </a>
      </p>`
    );
  }

  lines.push(`<p style="color:#667085; font-size:12px; margin-top:22px">
    Vous recevez cet e-mail car une baisse de prix a dépassé vos seuils d’alerte.
  </p>`);

  const html = `<div style="font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans','Apple Color Emoji','Segoe UI Emoji';font-size:14px;color:#101828">
    ${lines.join("")}
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: [TO],
    subject,
    html,
  });

  if (error) {
    console.error("[sendPriceAlertEmail] resend error:", error);
    return { ok: false, error };
  }
  return { ok: true };
}
