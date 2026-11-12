/// Calls into the app's own JS service on the TV (`service/`), which does what a web page can't:
/// requests to hosts that send no CORS headers. Off the TV (desktop browser) every call rejects.

const SERVICE = "luna://com.derrellwilliams.wavelane.service/";

interface Bridge {
  onservicecallback: ((message: string) => void) | null;
  call(uri: string, params: string): void;
}

declare global {
  interface Window {
    WebOSServiceBridge?: new () => Bridge;
  }
}

export const onTV = typeof window !== "undefined" && typeof window.WebOSServiceBridge === "function";

export function callService<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const Bridge = window.WebOSServiceBridge;
    if (!Bridge) {
      reject(new Error("Not running on webOS"));
      return;
    }
    const bridge = new Bridge();
    const timer = setTimeout(() => reject(new Error(`${method}: no reply in ${timeoutMs / 1000} s`)), timeoutMs);
    bridge.onservicecallback = (message) => {
      clearTimeout(timer);
      try {
        const reply = JSON.parse(message) as { returnValue?: boolean; errorText?: string };
        if (reply.returnValue === false) reject(new Error(reply.errorText ?? `${method} failed`));
        else resolve(reply as T);
      } catch {
        reject(new Error(`${method}: unreadable reply`));
      }
    };
    bridge.call(SERVICE + method, JSON.stringify(params));
  });
}
