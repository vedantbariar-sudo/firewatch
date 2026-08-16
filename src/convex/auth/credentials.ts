import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password-free, code-free sign-in: the user provides a name and an email and
 * is signed straight in. The first time an email appears, a user and account
 * are created; afterwards the same email signs into the same user.
 *
 * Hackathon demo tradeoff: no verification at all, so anyone can sign in as
 * any email. Do not ship this to production.
 */
export const nameAndEmail = ConvexCredentials({
  id: "credentials",
  authorize: async (params, ctx) => {
    const rawEmail = typeof params.email === "string" ? params.email : "";
    const email = rawEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    const rawName = typeof params.name === "string" ? params.name : "";
    const name = rawName.trim();

    // Reuse the existing account when this email has signed in before.
    let account;
    try {
      account = await retrieveAccount(ctx, {
        provider: "credentials",
        account: { id: email },
      });
    } catch {
      account = null;
    }

    if (account === null) {
      account = await createAccount(ctx, {
        provider: "credentials",
        account: { id: email },
        profile: {
          email,
          name: name || email.split("@")[0],
        },
      });
    }

    return { userId: account.user._id };
  },
});
