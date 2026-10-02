// Loads Paystack's own Inline checkout script on demand (never bundled -- only visitors who reach checkout pay
// for it) and wraps it in a promise-based call. The popup, card entry and 3-D Secure flow all happen on
// Paystack's own hosted UI; this app never sees or touches a card number.

declare global {
  interface Window {
    PaystackPop?: { setup(options: Record<string, unknown>): { openIframe(): void } };
  }
}

let scriptPromise: Promise<void> | null = null;
function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Couldn't reach Paystack -- check your connection and try again."));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export interface PaystackChargeOptions {
  publicKey: string;
  email: string;
  amountKobo: number;
  currency?: string;
  reference: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

export async function openPaystackCheckout(opts: PaystackChargeOptions) {
  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error("Paystack failed to load.");
  const handler = window.PaystackPop.setup({
    key: opts.publicKey,
    email: opts.email,
    amount: opts.amountKobo,
    currency: opts.currency || "NGN",
    ref: opts.reference,
    callback: (resp: { reference: string }) => opts.onSuccess(resp.reference),
    onClose: opts.onClose,
  });
  handler.openIframe();
}
