import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
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

    // 2) Primary delivery: the VLY email gateway. It emails exactly the code
    //    Convex generated and will verify, so what the user types is
    //    guaranteed to match. Mirrors the @vly-ai/integrations email client's
    //    request so no SDK import is needed inside the auth bundle.
    if (process.env.VLY_INTEGRATION_KEY) {
      try {
        const response = await fetch("https://integrations.vly.ai/v1/email/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.VLY_INTEGRATION_KEY}`,
            "Content-Type": "application/json",
            "X-Vly-Version": "0.1.0",
          },
          body: JSON.stringify({
            to: [email],
            from: "noreply@project.freebuff.dev",
            subject: "Your FireWatch sign-in code",
            ...buildOtpEmail("FireWatch", token),
          }),
        });
        if (response.ok) {
          console.log(`[emailOtp] code sent to ${email} via VLY email gateway`);
          return;
        }
        const body = await response.text().catch(() => "");
        console.error(
          `[emailOtp] VLY email gateway failed (${response.status}): ${body}`,
        );
      } catch (error) {
        console.error("[emailOtp] VLY email gateway threw:", error);
      }
    } else {
      console.error(
        "[emailOtp] VLY_INTEGRATION_KEY not set — falling back to OTP relay",
      );
    }

    // 3) Fallback: Freebuff OTP relay, kept for compatibility.
    const apiKey = process.env.FREEBUFF_EMAIL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Email sending is not configured — set VLY_INTEGRATION_KEY or FREEBUFF_EMAIL_API_KEY in the project Keys settings.",
      );
    }
    try {
      await axios.post(
        "https://auth.freebuff.app/send_otp",
        {
          to: email,
          otp: token,
          appName: "FireWatch",
        },
        {
          headers: {
            "x-api-key": apiKey,
          },
        },
      );
      console.log(`[emailOtp] code sent to ${email} via Freebuff OTP relay`);
    } catch (error) {
      throw new Error(JSON.stringify(error));
    }
  },
});
