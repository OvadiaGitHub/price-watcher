import "server-only";

export async function sendDiscordAlert(webhookUrl: string, text: string) {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[Discord webhook] HTTP", res.status, body);
    }
  } catch (e) {
    console.error("[Discord webhook] error", e);
  }
}
