/** Browser-only OneSignal Web SDK loader. */
type OS = {
  init: (o: Record<string, unknown>) => Promise<void>;
  login: (id: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: { permission: boolean; requestPermission: () => Promise<void> };
  User: { PushSubscription: { optedIn?: boolean; optIn: () => Promise<void>; optOut: () => Promise<void> } };
};
type W = Window & { OneSignalDeferred?: ((os: OS) => void)[] };

let ready: Promise<OS> | null = null;

export function loadOneSignal(appId: string): Promise<OS> {
  if (ready) return ready;
  ready = new Promise<OS>((resolve, reject) => {
    const w = window as W;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (os) => {
      try {
        await os.init({ appId, allowLocalhostAsSecureOrigin: true, serviceWorkerPath: "/OneSignalSDKWorker.js" });
        resolve(os);
      } catch (e) {
        reject(e);
      }
    });
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.onerror = () => reject(new Error("Could not load notifications."));
    document.head.appendChild(s);
  });
  return ready;
}

export type PushResult = "needs-web-setup" | "on" | "off" | "denied" | "open-in-new-tab" | "not-configured" | "unsupported";

export async function enablePush(appId: string | null, userId: string): Promise<PushResult> {
  if (!appId) return "not-configured";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (window.top !== window.self) return "open-in-new-tab";
  let os: OS;
  try {
    os = await loadOneSignal(appId);
  } catch (e) {
    ready = null;
    if (/web push|not configured|origin/i.test(String((e as Error)?.message ?? e))) return "needs-web-setup";
    throw e;
  }
  await os.login(userId);
  await os.Notifications.requestPermission();
  if (!os.Notifications.permission) return "denied";
  await os.User.PushSubscription.optIn();
  return "on";
}

export async function disablePush(appId: string | null): Promise<PushResult> {
  if (!appId) return "not-configured";
  const os = await loadOneSignal(appId);
  await os.User.PushSubscription.optOut();
  return "off";
}

export async function pushStatus(appId: string | null, userId: string): Promise<boolean> {
  if (!appId || window.top !== window.self || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const os = await loadOneSignal(appId);
  await os.login(userId);
  return Boolean(os.User.PushSubscription.optedIn);
}
