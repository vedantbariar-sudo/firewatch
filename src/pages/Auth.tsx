import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import logo from "@/assets/logo.svg";
import { ArrowRight, Loader2, Lock, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

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

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const {
    isLoading: authLoading,
    isAuthenticated,
    signInWithPassword,
    signUp,
    signInAnonymously,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signIn") {
        await signInWithPassword(email, password);
      } else {
        const result = await signUp(email, password);
        if (result.needsEmailConfirmation) {
          setNotice(
            "Account created. Check your inbox to confirm your email, then sign in.",
          );
          setMode("signIn");
        }
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await signInAnonymously();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Guest sign-in failed.";
      setError(
        message.toLowerCase().includes("anonymous")
          ? `${message} Enable anonymous sign-ins in your Supabase project's Authentication settings.`
          : message,
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-[350px] border shadow-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <img
                src={logo}
                alt="FireWatch logo"
                width={64}
                height={64}
                className="mb-4 mt-4 cursor-pointer rounded-lg"
                onClick={() => navigate("/")}
              />
            </div>
            <CardTitle className="text-xl">Welcome to FireWatch</CardTitle>
            <CardDescription>
              Authentication is being wired up
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm leading-6 text-muted-foreground">
              Supabase isn&apos;t configured yet. Add{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                VITE_SUPABASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                VITE_SUPABASE_ANON_KEY
              </code>{" "}
              in the project&apos;s Keys tab to enable sign-in.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full cursor-pointer"
              onClick={() => navigate("/")}
            >
              Back to FireWatch
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Auth Content */}
      <div className="flex flex-1 items-center justify-center">
        <div className="flex h-full flex-col items-center justify-center">
          <Card className="min-w-[350px] border pb-0 shadow-md">
            <CardHeader className="text-center">
              <div className="flex justify-center">
                <img
                  src={logo}
                  alt="FireWatch logo"
                  width={64}
                  height={64}
                  className="mb-4 mt-4 cursor-pointer rounded-lg"
                  onClick={() => navigate("/")}
                />
              </div>
              <CardTitle className="text-xl">Welcome to FireWatch</CardTitle>
              <CardDescription>
                {mode === "signIn"
                  ? "Sign in to access the operations console"
                  : "Create an account for your team"}
              </CardDescription>
            </CardHeader>

            {/* Mode switch */}
            <div className="px-6">
              <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/50 p-1">
                {(
                  [
                    { value: "signIn", label: "Sign in" },
                    { value: "signUp", label: "Create account" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => {
                      setMode(item.value);
                      setError(null);
                      setNotice(null);
                    }}
                    className={cn(
                      "flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      mode === item.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="name@example.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      name="password"
                      placeholder="Password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
                {notice && (
                  <p className="mt-3 text-sm text-emerald-500">{notice}</p>
                )}

                <Button
                  type="submit"
                  className="mt-4 w-full cursor-pointer"
                  disabled={isLoading || !email.trim() || password.length < 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "signIn" ? "Signing in…" : "Creating account…"}
                    </>
                  ) : mode === "signIn" ? (
                    <>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    "Create account"
                  )}
                </Button>

                <div className="relative mt-5">
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
                  className="mt-4 w-full cursor-pointer"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Try it as a guest
                </Button>
              </CardContent>
            </form>

            <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
              Secured by{" "}
              <a
                href="https://freebuff.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-primary"
              >
                freebuff.com
              </a>{" "}
              · Authenticated with{" "}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline transition-colors hover:text-primary"
              >
                Supabase
              </a>
            </div>
          </Card>
        </div>
      </div>
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
