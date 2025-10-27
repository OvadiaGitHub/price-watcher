export const dynamic = "force-dynamic";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function Page() {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .select("id, booking_id, check_id, delta_abs, delta_pct, channel, sent_at")
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) {
    return <pre style={{color:"crimson"}}>Erreur: {error.message}</pre>;
  }

  return (
    <div style={{padding:20}}>
      <h1>Dernières alertes</h1>
      <table border={1} cellPadding={6} style={{borderCollapse:"collapse", width:"100%"}}>
        <thead>
          <tr>
            <th>sent_at</th>
            <th>booking_id</th>
            <th>delta</th>
            <th>channel</th>
            <th>check</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((r:any) => (
            <tr key={r.id}>
              <td>{new Date(r.sent_at).toISOString().slice(0,19).replace("T"," ")}</td>
              <td>{r.booking_id}</td>
              <td>€{Math.round(r.delta_abs)}{r.delta_pct ? ` (~${Math.round(r.delta_pct*100)}%)` : ""}</td>
              <td>{r.channel}</td>
              <td><a href={`/admin/last-checks#${r.check_id}`}>{r.check_id?.slice(0,8)}</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
