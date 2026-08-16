import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { api } from "../_generated/api";

const OTP_LIFETIME_MIN = 15;

function buildOtpEmail(appName: string, code: string) {
  const text = [
    `Your ${appName} sign-in code is: ${code}`,
    "",
    `This code expires in ${OTP_LIFETIME_MIN} minutes.`,
    "If you didn't request this email, you can safely ignore it.",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0f16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f16;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:#11151d;border:1px solid #232a36;border-radius:16px;padding:32px 28px;">
            <tr>
              <td align="center" style="color:#f97316;font-size:13px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${appName}</td>
            </tr>
            <tr>
              <td align="center" style="color:#f4f4f5;font-size:22px;font-weight:600;padding:18px 0 6px;">Your sign-in code</td>
            </tr>
            <tr>
              <td align="center" style="color:#a1a1aa;font-size:14px;line-height:1.5;">Enter this code to sign in. It expires in ${OTP_LIFETIME_MIN} minutes.</td>
            </tr>
            <tr>
              <td align="center" style="padding:22px 0 8px;">
                <span style="display:inline-block;background:#1a2029;border:1px solid #2a3342;border-radius:12px;color:#fbbf24;font-size:32px;font-weight:700;letter-spacing:0.3em;padding:14px 22px;">${code}</span>
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#71717a;font-size:12px;line-height:1.5;padding-top:14px;">If you didn't request this email, you can safely ignore it.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

/**
 * Send the sign-in code via Resend. Returns true when Resend accepted the
 * email, false when the key is missing or the request failed.
 *
 * The body is built locally and contains exactly the `code` Convex generated
 * and will verify — so the code in the inbox always matches what the server
 * checks. Uses Resend's REST API directly (no SDK import inside the auth
 * bundle).
 */
async function sendViaResend(email: string, code: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[emailOtp] RESEND_API_KEY not set");
    return false;
  }

  const { text, html } = buildOtpEmail("FireWatch", code);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Until a custom domain is verified, Resend only delivers from
        // onboarding@resend.dev to the account owner's address — perfect for
        // the hackathon. Set RESEND_FROM_EMAIL once a domain is verified.
        from:
          process.env.RESEND_FROM_EMAIL ?? "FireWatch <onboarding@resend.dev>",
        to: [email],
        subject: "Your FireWatch sign-in code",
        text,
        html,
      }),
    });
    if (response.ok) {
      console.log(`[emailOtp] code sent to ${email} via Resend`);
      return true;
    }
    const body = await response.text().catch(() => "");
    console.error(`[emailOtp] Resend failed (${response.status}): ${body}`);
    return false;
  } catch (error) {
    console.error("[emailOtp] Resend request threw:", error);
    return false;
  }
}

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * OTP_LIFETIME_MIN, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest(
    { identifier: email, token },
    // The auth action context — used here only to clear Convex Auth's
    // failed-attempt counter. The library passes it as a second argument at
    // runtime even though its declared type only lists the params; `any`
    // because the ctx type is not exported.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx?: any,
  ) {
    // 1) Clear any existing failed-attempt lockout for this address so a
    //    correct code is never rejected because of earlier failed attempts.
    //    The counter is reset the moment a fresh code is issued.
    try {
      await ctx.runMutation(api.users.resetSignInAttempts, { email });
    } catch (error) {
      console.error("[emailOtp] could not reset sign-in attempt counter:", error);
    }

    // 2) Record the raw code so the auth page can show it as a fallback when
    //    email delivery is unavailable (see getOtpDemoCode). Verification
    //    still uses the hashed copy Convex Auth stores.
    try {
      await ctx.runMutation(api.users.storePendingOtpCode, {
        email,
        code: token,
        expiresAt: Date.now() + OTP_LIFETIME_MIN * 60 * 1000,
      });
    } catch (error) {
      console.error("[emailOtp] could not store demo code:", error);
    }

    // 3) Primary delivery: Resend. Deliberately non-throwing — if email can't
    //    be sent (missing key, invalid key, API error), the code stored above
    //    is still shown in the app so sign-in remains possible during the
    //    demo. The log line below says which path ran.
    const sent = await sendViaResend(email, token);
    if (!sent) {
      console.error(
        "[emailOtp] email delivery failed — the auth page will show the code in demo mode",
      );
    }
  },
});
