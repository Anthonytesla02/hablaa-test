/** Server-only OneSignal REST helper. */
export async function sendOneSignal(opts: {
  externalIds: string[];
  heading: string;
  message: string;
  url?: string;
}) {
  const appId = process.env["ONESIGNAL_APP_ID"];
  const key = process.env["ONESIGNAL_REST_API_KEY"];
  if (!appId || !key) throw new Error("Notifications are not configured yet.");
  if (opts.externalIds.length === 0) return null;

  const res = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      app_id: appId,
      target_channel: "push",
      include_aliases: { external_id: opts.externalIds.slice(0, 2000) },
      headings: { en: opts.heading },
      contents: { en: opts.message },
      ...(opts.url ? { url: opts.url } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`OneSignal failed [${res.status}]: ${body}`);
    throw new Error(`OneSignal failed [${res.status}]: ${body}`);
  }
  return res.json();
}
