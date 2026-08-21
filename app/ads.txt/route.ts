export async function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();
  if (!client || !/^ca-pub-\d+$/.test(client)) {
    return new Response("AdSense publisher ID is not configured.\n", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const publisher = client.replace(/^ca-/, "");
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
