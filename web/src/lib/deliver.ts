import { all, one, run } from "./db";
import { url } from "./hosts";
import { brand } from "./brand";
import { capture, warn } from "./observe";

/**
 * Getting the thing to the person.
 *
 * Fulfilment buys the entitlement. Delivery tells the customer it exists. They
 * are separate steps because they fail separately and for different reasons: a
 * supplier outage and a mail provider outage are different problems with
 * different fixes, and collapsing them means an email failure looks like a
 * provisioning failure and somebody reprovisions a profile that already exists.
 *
 * ## What the email does and does not contain
 *
 * It contains a link. It does not contain the activation code, the QR image or
 * the SM DP plus address.
 *
 * That is deliberate and it is the opposite of what most eSIM sellers do. An
 * activation code is a bearer credential: whoever has it can install the
 * profile, once, and then the paying customer cannot. Email is forwarded,
 * synced to three devices, backed up to a provider the customer does not
 * control and, often enough, read on an airport network. Putting a
 * single use credential in it is putting it in all of those places.
 *
 * The cost is one extra tap. The benefit is that a forwarded receipt cannot
 * burn somebody's plan.
 *
 * ## Delivery is recorded
 *
 * `delivered_at` on the order, so a resend is a decision rather than a guess,
 * and so "did they ever get it" is answerable in the console rather than in a
 * mail provider's dashboard.
 */

export interface DeliveryResult {
  sent: boolean;
  reason?: string;
}

/**
 * Send the "it is ready" email for an order.
 *
 * Idempotent in the way that matters: it will not send twice for the same set
 * of entitlements. A second call after a second line is fulfilled does send
 * again, which is correct, because the customer now has something they did not
 * have when the first email went out.
 */
export async function deliver(orderId: string): Promise<DeliveryResult> {
  const order = await one<{
    id: string; user_id: string; status: string;
    sell_currency: string; sell_amount: string;
    delivered_count: number | null;
  }>(
    `SELECT o.id, o.user_id, o.status, o.sell_currency, o.sell_amount, o.delivered_count
       FROM orders o WHERE o.id = ?`,
    [orderId],
  );

  if (!order) return { sent: false, reason: "no_such_order" };

  const ents = await all<{ label: string; category: string }>(
    `SELECT e.label, e.category
       FROM entitlements e
       JOIN order_items oi ON oi.id = e.order_item_id
      WHERE oi.order_id = ?`,
    [orderId],
  );

  if (ents.length === 0) return { sent: false, reason: "nothing_to_deliver" };

  // Already told them about exactly this much. Sending again would be a
  // duplicate rather than an update.
  if ((order.delivered_count ?? 0) >= ents.length) {
    return { sent: false, reason: "already_delivered" };
  }

  const to = await recipient(order.user_id);
  if (!to) {
    /*
     * No address. Not an error yet: the entitlement exists, it is on the
     * account, and the customer is looking at the success page which shows it.
     * Recorded as a warning because a customer who closes that tab has no way
     * back, and that is worth somebody noticing.
     */
    await warn("deliver", new Error("Order fulfilled but no email address on file"), {
      orderId,
    });
    return { sent: false, reason: "no_email" };
  }

  const sent = await send(to, {
    orderId,
    items: ents.map((e) => e.label),
    total: `${order.sell_currency} ${Number(order.sell_amount).toFixed(2)}`,
  });

  if (sent) {
    await run(
      `UPDATE orders SET delivered_at = now(), delivered_count = ? WHERE id = ?`,
      [ents.length, orderId],
    );
  }

  return { sent, reason: sent ? undefined : "mail_failed" };
}

/**
 * Send it again, from the console.
 *
 * Separate from deliver() because it deliberately ignores the already delivered
 * check. The whole reason somebody presses this button is that the first one
 * did not arrive, and a resend that refuses on the grounds that it was already
 * sent is a resend button that does nothing.
 */
export async function redeliver(orderId: string): Promise<DeliveryResult> {
  await run(`UPDATE orders SET delivered_count = 0 WHERE id = ?`, [orderId]);
  return deliver(orderId);
}

async function recipient(userId: string): Promise<string | null> {
  const u = await one<{ email: string | null }>(
    `SELECT email FROM users WHERE id = ?`,
    [userId],
  );
  return u?.email ?? null;
}

async function send(
  to: string,
  data: { orderId: string; items: string[]; total: string },
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const link = url("app", "/esims");

  if (!key) {
    /*
     * No provider configured.
     *
     * Logged rather than thrown, and deliberately NOT gated on NODE_ENV. The
     * situation this exists for is a real deployment on the day the first order
     * arrives and the mail provider is not signed up yet. A NODE_ENV check
     * would turn that into a crash on the most important request the business
     * has ever served.
     */
    console.warn(
      `[deliver] no RESEND_API_KEY, so no email was sent for ${data.orderId} to ${to}`,
    );
    return false;
  }

  const text =
    `Your ${brand.name} order is ready.\n\n` +
    data.items.map((i) => `  ${i}`).join("\n") +
    `\n\nOpen it here to install:\n${link}\n\n` +
    `Install it before you fly, on wifi. Setting up an eSIM needs a working ` +
    `connection, and the airport is the worst possible place to find that out.\n\n` +
    `The install details are not in this email on purpose. An activation code ` +
    `works once, and email gets forwarded, synced and read on networks you do ` +
    `not control. Yours stays behind the link above.\n\n` +
    `Order ${data.orderId}, ${data.total}.\n`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? `${brand.name} <hello@bilbymobile.com>`,
        to,
        subject: `Your ${brand.name} plan is ready`,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      await capture("deliver", new Error(`Resend rejected the send: ${res.status}`), {
        orderId: data.orderId,
        status: res.status,
        body: (await res.text()).slice(0, 500),
      });
      return false;
    }
    return true;
  } catch (e) {
    await capture("deliver", e, { orderId: data.orderId });
    return false;
  }
}
