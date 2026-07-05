/**
 * Khalti KPG-2 (ePayment) client.
 *
 * Sandbox base: https://dev.khalti.com/api/v2  (test secret key)
 * Production:   https://khalti.com/api/v2      (live secret key)
 *
 * Rule #1 of payments: the redirect back from Khalti proves nothing.
 * Only a server-side /epayment/lookup/ with status "Completed" and a
 * matching amount is money.
 */

const BASE = (process.env.KHALTI_BASE_URL ?? "https://dev.khalti.com/api/v2").replace(/\/$/, "");

export function khaltiConfigured(): boolean {
  return Boolean(process.env.KHALTI_SECRET_KEY);
}

function headers(): HeadersInit {
  return {
    Authorization: `Key ${process.env.KHALTI_SECRET_KEY}`,
    "Content-Type": "application/json",
  };
}

export type KhaltiInitiate = { pidx: string; payment_url: string; expires_at?: string };

export async function khaltiInitiate(args: {
  amountNpr: number;
  orderId: string;
  orderName: string;
  returnUrl: string;
  websiteUrl: string;
}): Promise<KhaltiInitiate> {
  const res = await fetch(`${BASE}/epayment/initiate/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: Math.round(args.amountNpr * 100), // Khalti bills in paisa
      purchase_order_id: args.orderId,
      purchase_order_name: args.orderName,
      return_url: args.returnUrl,
      website_url: args.websiteUrl,
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.pidx || !json?.payment_url) {
    throw new Error(`khalti initiate failed (${res.status}): ${JSON.stringify(json)?.slice(0, 300)}`);
  }
  return json as KhaltiInitiate;
}

export type KhaltiLookup = {
  pidx: string;
  status: "Completed" | "Pending" | "Initiated" | "Refunded" | "Expired" | "User canceled" | string;
  total_amount: number; // paisa
  transaction_id?: string;
};

export async function khaltiLookup(pidx: string): Promise<KhaltiLookup> {
  const res = await fetch(`${BASE}/epayment/lookup/`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ pidx }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.pidx) {
    throw new Error(`khalti lookup failed (${res.status}): ${JSON.stringify(json)?.slice(0, 300)}`);
  }
  return json as KhaltiLookup;
}
