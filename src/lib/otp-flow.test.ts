import assert from "node:assert";
import { ConvexHttpClient } from "convex/browser";

/**
 * End-to-end test of the email-OTP flow against the live Convex deployment.
 *
 * Exercises exactly what the auth page does:
 *   1. request a code for an email (auth:signIn without code)
 *   2. read the code back through the demo-code query (users:getOtpDemoCode)
 *   3. verify the code (auth:signIn with code) and expect a signed-in result
 *
 * Needs the dev deployment URL; falls back to the standard site URL env var.
 */
const DEPLOY_URL =
  process.env.VITE_CONVEX_URL ??
  process.env.CONVEX_SITE_URL ??
  "https://compassionate-deer-337.convex.cloud";

const client = new ConvexHttpClient(DEPLOY_URL);

// `auth:signIn` is Convex Auth's special namespaced action, which the typed
// client doesn't know about — cast to the string form it accepts at runtime.
// The methods must stay bound to the client instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const action = client.action.bind(client) as (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
) => Promise<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const query = client.query.bind(client) as (
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any,
) => Promise<any>;

async function requestCode(email: string) {
  return action("auth:signIn", {
    provider: "email-otp",
    params: { email },
  });
}

async function getDemoCode(email: string) {
  return query("users:getOtpDemoCode", { email });
}

async function verifyCode(email: string, code: string) {
  return action("auth:signIn", {
    provider: "email-otp",
    params: { email, code },
  });
}

test("email-otp: request -> demo code -> verify succeeds", async () => {
  const email = `otp-e2e-${Date.now()}@example.com`;

  const started = await requestCode(email);
  assert.deepEqual(started, { started: true });

  // The code the auth page would show in demo mode — same token the email gets.
  const demo = await getDemoCode(email);
  assert.ok(demo, "demo code is stored after requesting sign-in");
  assert.match(demo.code, /^\d{6}$/, "code is a 6-digit numeric code");

  const result = await verifyCode(email, demo.code);
  assert.ok(
    result.tokens?.token && result.tokens?.refreshToken,
    "verification returns session tokens",
  );
  console.log("PASS: correct code verifies and returns tokens");
});

test("email-otp: a wrong code is rejected", async () => {
  const email = `otp-e2e-wrong-${Date.now()}@example.com`;
  await requestCode(email);

  const demo = await getDemoCode(email);
  assert.ok(demo, "demo code is stored");

  const wrong = demo.code === "000000" ? "000001" : "000000";
  await assert.rejects(
    () => verifyCode(email, wrong),
    /Could not verify code/,
  );
  console.log("PASS: wrong code rejected with the expected error");
});

test("email-otp: the same code cannot be verified twice", async () => {
  const email = `otp-e2e-twice-${Date.now()}@example.com`;
  await requestCode(email);
  const demo = await getDemoCode(email);
  assert.ok(demo);

  const first = await verifyCode(email, demo.code);
  assert.ok(first.tokens?.token, "first verification succeeds");
  console.log("PASS: first verification of the code succeeds");

  // After a successful (or any) attempt the code row is consumed server-side.
  const again = await getDemoCode(email);
  assert.equal(again, null, "consumed code no longer shows in demo mode");

  await assert.rejects(() => verifyCode(email, demo.code));
  console.log("PASS: reusing the consumed code fails");
});
