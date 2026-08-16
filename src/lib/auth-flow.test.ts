import assert from "node:assert";
import { ConvexHttpClient } from "convex/browser";

/**
 * End-to-end test of the name+email sign-in flow against the live Convex
 * deployment. Exercises exactly what the auth page does:
 *   1. sign in with name + email (auth:signIn, "credentials" provider)
 *   2. use the returned JWT for an authenticated query (users:currentUser)
 *   3. confirm the same email signs into the same account on repeat visits
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

async function signIn(name: string, email: string) {
  return action("auth:signIn", {
    provider: "credentials",
    params: { name, email },
  });
}

async function currentUser(token: string) {
  client.setAuth(token);
  return query("users:currentUser", {});
}

test("credentials: name + email signs in and returns a working session", async () => {
  const email = `auth-e2e-${Date.now()}@example.com`;

  const result = await signIn("Alex Rivera", email);
  assert.ok(
    result.tokens?.token && result.tokens?.refreshToken,
    "sign-in returns session tokens",
  );

  const user = await currentUser(result.tokens.token);
  assert.ok(user, "JWT is accepted for authenticated queries");
  assert.equal(user.email, email);
  assert.equal(user.name, "Alex Rivera");
  console.log("PASS: name + email sign-in works end to end");
});

test("credentials: the same email reuses the same account", async () => {
  const email = `auth-e2e-repeat-${Date.now()}@example.com`;

  const first = await signIn("Jordan Lee", email);
  const second = await signIn("Jordan Lee", email);

  const firstUser = await currentUser(first.tokens.token);
  const secondUser = await currentUser(second.tokens.token);
  assert.equal(firstUser._id, secondUser._id, "same user on repeat sign-in");
  console.log("PASS: repeat sign-in reuses the account");
});

test("credentials: an invalid email is rejected", async () => {
  await assert.rejects(
    () => signIn("Test", "not-an-email"),
    /valid email/,
  );
  console.log("PASS: invalid email rejected");
});
