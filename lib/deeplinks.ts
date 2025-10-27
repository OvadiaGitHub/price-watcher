import "server-only";

type BookingLike = {
  url: string;
  site_domain?: string;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number | null;
  children?: number | null;
  currency_paid?: string | null;
};

// util small
const fmtDate = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n || 0));

/** Booking.com deeplink
 * Exemples :
 * https://www.booking.com/hotel/fr/<slug>.html?checkin=2025-11-20&checkout=2025-11-22&group_adults=2&group_children=0&no_rooms=1&selected_currency=EUR
 * Si on ne parvient pas à extraire le slug, on retombe sur une recherche par dates.
 */
export function buildBookingComDeeplink(b: BookingLike): string | null {
  if (!b?.url) return null;
  const u = new URL(b.url);

  // safety: for *.booking.com only
  if (!/(\.|^)booking\.com$/i.test(u.hostname)) return null;

  const checkin = fmtDate(b.checkin);
  const checkout = fmtDate(b.checkout);
  const adults = clamp(b.adults ?? 2, 1, 8);
  const children = clamp(b.children ?? 0, 0, 8);
  const curr = (b.currency_paid || "EUR").toUpperCase();

  // Try to preserve the hotel path if present
  // /hotel/<country>/<slug>.html
  let path = u.pathname;
  if (!/\/hotel\/.+\.html$/i.test(path)) {
    // fallback: generic search
    path = "/searchresults.html";
  }

  const out = new URL(`https://www.booking.com${path}`);
  if (checkin) out.searchParams.set("checkin", checkin);
  if (checkout) out.searchParams.set("checkout", checkout);
  out.searchParams.set("group_adults", String(adults));
  out.searchParams.set("group_children", String(children));
  out.searchParams.set("no_rooms", "1");
  out.searchParams.set("selected_currency", curr);

  return out.toString();
}

/** Expedia deeplink (recherche)
 * On n’a pas toujours l’ID exact de l’hôtel → on ouvre la recherche avec dates & occupants.
 * Ex:
 * https://www.expedia.fr/Hotel-Search?checkIn=2025-11-20&checkOut=2025-11-22&adults=2&rooms=1&children=0&currency=EUR
 */
export function buildExpediaDeeplink(b: BookingLike): string | null {
  if (!b?.url) return null;
  const u = new URL(b.url);

  // *.expedia.*
  if (!/(\.|^)expedia\./i.test(u.hostname)) return null;

  const checkin = fmtDate(b.checkin);
  const checkout = fmtDate(b.checkout);
  const adults = clamp(b.adults ?? 2, 1, 8);
  const children = clamp(b.children ?? 0, 0, 8);
  const curr = (b.currency_paid || "EUR").toUpperCase();

  const base = `https://${u.hostname.replace(/^www\./, "")}/Hotel-Search`;
  const out = new URL(base);
  if (checkin) out.searchParams.set("checkIn", checkin);
  if (checkout) out.searchParams.set("checkOut", checkout);
  out.searchParams.set("adults", String(adults));
  out.searchParams.set("rooms", "1");
  out.searchParams.set("children", String(children));
  out.searchParams.set("currency", curr);

  return out.toString();
}

/** Routeur : renvoie le meilleur deeplink selon la plateforme détectée */
export function buildHotelDeeplink(b: BookingLike): string | null {
  const host = (b.site_domain || "").toLowerCase();
  if (host.includes("booking.com")) return buildBookingComDeeplink(b);
  if (host.includes("expedia")) return buildExpediaDeeplink(b);
  // fallback: renvoyer l’URL d’origine (à défaut)
  try {
    return new URL(b.url).toString();
  } catch {
    return null;
  }
}
