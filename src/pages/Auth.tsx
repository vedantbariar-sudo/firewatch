import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

/** Turn Convex Auth errors into messages anyone can understand. */
function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  // The library throws a plain Error (no code) when the entered code doesn't
  // match any active one — expired, already used, or replaced by a resend.
  if (/could not verify code/i.test(message)) {
    return "That code didn't work — it may have expired or already been used. Request a new one and try again.";
  }
  switch (code) {
    case "AUTH_INVALID_EMAIL":
      return "That email address doesn't look right. Please check it and try again.";
    case "AUTH_CODE_INVALID":
      return "That code doesn't match. Please double-check it and try again.";
    case "AUTH_CODE_EXPIRED":
      return "That code has expired. Request a new one and try again.";
    case "AUTH_TOO_MANY_ATTEMPTS":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "AUTH_RATE_LIMITED":
      return "Too many requests. Please wait a moment and try again.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Please try again.";
  }
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // Demo mode: the issued code is stored server-side (getOtpDemoCode) so it
  // can be shown here when email delivery is unreliable. It is verified the
  // same way as the emailed code.
  const demoCode = useQuery(api.users.getOtpDemoCode, { email });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Synchronous guard: OTP codes are single-use, so submitting the same code
  // twice (6th-digit onChange + form submit racing in the same tick) makes the
  // second call fail with "Could not verify code". A ref is checked and set
  // before any await, unlike `isLoading`, which updates asynchronously.
  const submittingRef = useRef(false);

  const runGuarded = async (fn: () => Promise<void>) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  // True once a sign-in completes on this page (email OTP or guest). The
  // redirect only fires when the user authenticates *here* — or arrived with a
  // destination (returnTo) already in mind — so an active session no longer
  // makes the "Sign in" button bounce straight to the dashboard before the
  // form can show.
  const signedInHereRef = useRef(false);

  // Once signed in, send the user where they were going.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const hasDestination = searchParams.get("returnTo") !== null;
      if (signedInHereRef.current || hasDestination) {
        navigate(redirect);
      }
    }
  }, [authLoading, isAuthenticated, navigate, redirect, searchParams]);

  const sendCode = async (resend = false) => {
    await runGuarded(async () => {
      await signIn("email-otp", { email });
      // Drop any previously entered (now-consumed) code and stale errors so
      // the input never holds a code the server can no longer verify.
      setCode("");
      setError(null);
      setStep("code");
      setNotice(
        resend
          ? "A new code is on its way."
          : `We emailed a 6-digit code to ${email}.`,
      );
    });
  };

  const verifyCode = async (enteredCode?: string) => {
    // The OTP onChange fires before setCode re-renders, so it passes the fresh
    // value explicitly — otherwise the auto-verify on the 6th digit would send
    // the previous 5-digit code and always fail with "Could not verify code".
    const codeToVerify = enteredCode ?? code;
    await runGuarded(async () => {
      await signIn("email-otp", { email, code: codeToVerify });
      signedInHereRef.current = true;
      // The redirect happens automatically once the session is confirmed.
    });
  };

  const handleGuestSignIn = async () => {
    await runGuarded(async () => {
      await signIn("anonymous");
      signedInHereRef.current = true;
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-[400px] border">
        <CardHeader className="text-center">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer"
              aria-label="Back to FireWatch"
            >
              <img
                src={logo}
                alt="FireWatch logo"
                width={64}
                height={64}
                className="rounded-lg"
              />
            </button>
          </div>
          <CardTitle className="mt-4 text-xl font-semibold tracking-tight">
            Welcome to FireWatch
          </CardTitle>
          <CardDescription className="mx-auto max-w-[280px]">
            {step === "email"
              ? "Sign in with your email — no password needed."
              : `Enter the 6-digit code sent to ${email}.`}
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          {step === "email" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void sendCode();
              }}
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Email address
                  </span>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 pl-9"
                      disabled={isLoading}
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="h-11 w-full cursor-pointer"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void verifyCode();
              }}
            >
              <div className="space-y-4">
                {notice && (
                  <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                    {notice}
                  </p>
                )}

                {demoCode && (
                  <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-400">
                    Demo mode — your code is{" "}
                    <span className="font-mono text-base font-semibold tracking-wider">
                      {demoCode.code}
                    </span>
                  </p>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">
                    Verification code
                  </span>
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(value) => {
                      setCode(value);
                      if (value.length === 6) void verifyCode(value);
                    }}
                    disabled={isLoading}
                    autoFocus
                  >
                    <InputOTPGroup className="w-full justify-between">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="h-12 flex-1 text-base"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  type="submit"
                  className="h-11 w-full cursor-pointer"
                  disabled={isLoading || code.length < 6}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Verify &amp; sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                    }}
                    className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendCode(true)}
                    className="cursor-pointer font-medium text-primary hover:underline"
                    disabled={isLoading}
                  >
                    Resend code
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full cursor-pointer"
            onClick={() => void handleGuestSignIn()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserRound className="h-4 w-4" />
                Continue as guest
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No account needed — explore the live demo right away.
          </p>
        </CardContent>
      </Card>

      <p className="mt-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        One-time codes only — no passwords stored.
      </p>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
