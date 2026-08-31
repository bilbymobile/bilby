import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { currentUser } from "@/lib/session";
import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

interface EsimRow {
  iccid: string;
  activation_code: string;
  smdp_address: string;
  matching_id: string;
  is_free_tier: number;
}

/**
 * eSIM installation.
 *
 * Three routes onto a handset, in descending order of how many users actually
 * complete them:
 *
 *  1. UNIVERSAL LINK — one tap, straight into the OS eSIM installer.
 *     iOS 17.4+   https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=<LPA>
 *     Android 10+ https://esimsetup.android.com/esim_qrcode_provisioning?carddata=<LPA>
 *     Same parameter, same LPA payload, different host. This is the single
 *     biggest conversion lever in the whole funnel and costs nothing to add.
 *
 *  2. QR CODE — for installing on a second device. Useless on the device
 *     showing it, which is why it is not the primary call to action.
 *
 *  3. MANUAL ENTRY — SM-DP+ address and activation code typed by hand. Ugly,
 *     but it is the only thing that works on older Androids and it converts the
 *     users who would otherwise open a support ticket.
 *
 * Show all three. Lead with the link.
 */
export default async function InstallPage({
  params,
}: {
  params: Promise<{ iccid: string }>;
}) {
  const { iccid } = await params;
  const user = await currentUser();

  const row = await one<EsimRow>(
    `SELECT iccid, activation_code, smdp_address, matching_id, is_free_tier
     FROM esims WHERE iccid = ? AND user_id = ?`,
    [iccid, user.id]
  );

  if (!row) notFound();

  const lpa = row.activation_code;
  const encoded = encodeURIComponent(lpa);
  const appleLink = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encoded}`;
  const androidLink = `https://esimsetup.android.com/esim_qrcode_provisioning?carddata=${encoded}`;

  const qrDataUrl = await QRCode.toDataURL(lpa, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  return (
    <>
      <section className="hero">
        <h1>Install your eSIM</h1>
        <p>
          One tap on the device you want it on. Do this while you still have
          Wi‑Fi, because profile download needs a connection and the whole point is
          that you won&apos;t have one when you land.
        </p>
      </section>

      <div className="card">
        <h2>One-tap install</h2>
        <p className="sub">
          Open this page <em>on the phone that will use the eSIM</em>, then tap
          your platform.
        </p>
        <div className="row">
          <a className="btn" href={appleLink}>
            Install on iPhone (iOS 17.4+)
          </a>
          <a className="btn ghost" href={androidLink}>
            Install on Android (10+)
          </a>
        </div>
        <div className="note">
          Older iOS and Android builds don&apos;t recognise these links and will
          open a browser page instead. That&apos;s expected, so use the QR code or
          manual details below.
        </div>
      </div>

      <div className="grid two">
        <div className="card">
          <h2>Scan from another device</h2>
          <p className="sub">Camera app or Settings → Mobile → Add eSIM.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="qr">
            <img src={qrDataUrl} alt={`eSIM activation QR for ${row.iccid}`} width={220} height={220} />
          </div>
        </div>

        <div className="card">
          <h2>Enter manually</h2>
          <p className="sub">Every device supports this, including pre-Android 10.</p>
          <table>
            <tbody>
              <tr>
                <th>SM-DP+ address</th>
                <td>
                  <code>{row.smdp_address}</code>
                </td>
              </tr>
              <tr>
                <th>Activation code</th>
                <td>
                  <code>{row.matching_id}</code>
                </td>
              </tr>
              <tr>
                <th>ICCID</th>
                <td>
                  <code>{row.iccid}</code>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="sub" style={{ marginTop: 16, marginBottom: 6 }}>
            Full LPA string:
          </p>
          <pre className="lpa">{lpa}</pre>
        </div>
      </div>

      <div className="card">
        <h2>After it installs</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          Turn <strong>data roaming ON</strong> for this eSIM. It is a roaming
          profile by design. With roaming off it will attach to nothing and look
          broken, and this is the single most common support ticket in the
          category.
        </p>
        <p className="sub" style={{ margin: 0 }}>
          Keep your home SIM as the default for calls and texts. Set nesim as the
          data line only.
        </p>
      </div>
    </>
  );
}
