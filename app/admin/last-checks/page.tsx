export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function Page() {
  const { data, error } = await supabaseAdmin
    .from("checks")
    .select("id, booking_id, price_found, currency_found, status, run_ms, checked_at, meta")
    .order("checked_at", { ascending: false })
    .limit(20);

  if (error) {
    return <pre style={{color:"crimson"}}>Erreur: {error.message}</pre>;
  }

  return (
    <div style={{padding:20}}>
      <h1>Derniers checks</h1>
      <table border={1} cellPadding={6} style={{borderCollapse:"collapse", width:"100%"}}>
        <thead>
          <tr>
            <th>checked_at</th>
            <th>booking_id</th>
            <th>price_found</th>
            <th>status</th>
            <th>deeplink</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((r:any) => (
            <tr key={r.id}>
              <td>{new Date(r.checked_at).toISOString().slice(0,19).replace("T"," ")}</td>
              <td>{r.booking_id}</td>
              <td>{r.price_found} {r.currency_found}</td>
              <td>{r.status}</td>
              <td>
                {r.meta?.deeplink ? (
                  <a href={r.meta.deeplink} target="_blank">ouvrir</a>
                ) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
