import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
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
  const message = error instanceof Error ? error.message : "";
  if (message) {
    return message;
  }
  return "Something went wrong. Please try again.";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronous guard: prevents a second submit while the first request is
  // still in flight. A ref is checked and set before any await, unlike
  // `isLoading`, which updates asynchronously.
  const submittingRef = useRef(false);

  // Send an already-signed-in visitor to their destination when they arrived
  // with one in mind (e.g. RequireAuth bounced them here). Without this, an
  // active session would sit on the form forever. The form itself navigates
  // directly on submit, so an active session never auto-bounces the "Sign in"
  // button straight to the dashboard before the form can show.
  useEffect(() => {
    if (!authLoading && isAuthenticated && searchParams.get("returnTo") !== null) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect, searchParams]);

  const signInWithNameAndEmail = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || submittingRef.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("credentials", {
        email: trimmedEmail,
        ...(name.trim() ? { name: name.trim() } : {}),
      });
      // Navigate straight to the destination. Don't wait for the auth-state
      // effect to notice the change: when a session already existed, signing
      // in again flips no state and the effect never fires, leaving the
      // button looking dead.
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
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
            Sign in with your name and email — no passwords or codes.
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void signInWithNameAndEmail();
            }}
          >
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">
                  Your name{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </span>
                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    name="name"
                    type="text"
                    placeholder="Alex Rivera"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 pl-9"
                    disabled={isLoading}
                    autoComplete="name"
                    autoFocus
                  />
                </div>
              </label>

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
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>

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
        No passwords stored — just your name and email.
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
