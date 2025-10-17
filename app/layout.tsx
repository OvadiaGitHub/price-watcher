// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body><div style={{padding:"8px 12px", background:"#f8f8f8", borderBottom:"1px solid #eee", fontSize:12}}>
  <a href="/" style={{marginRight:12, textDecoration:"none"}}>Accueil</a>
  <a href="/mes-suivis" style={{marginRight:12, textDecoration:"none"}}>Mes suivis</a>
  <a href="/api/version" style={{textDecoration:"none"}}>Version</a>
</div>
{children}</body>
    </html>
  );
}
