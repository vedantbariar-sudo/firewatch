import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { cn } from "@/lib/utils";

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
    isActive
      ? "bg-accent text-foreground"
      : "text-muted-foreground hover:text-foreground",
  );
}

interface AppShellProps {
  children: ReactNode;
  active?: "operations" | "incidents";
}

export function AppShell({ children, active }: AppShellProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const now = useClock();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const displayName = user?.name || user?.email || "Team member";
  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 lg:px-6">
          <Link
            to="/dashboard"
            className="flex shrink-0 items-center gap-2.5"
            aria-label="FireWatch home"
          >
            <img src={logo} alt="FireWatch logo" className="size-8 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">
              FireWatch
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 sm:flex">
            <NavLink to="/dashboard" className={navClass} end>
              Operations
            </NavLink>
            <NavLink to="/incidents" className={navClass}>
              Incidents
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
              <span className="tabular-nums">
                {now.toLocaleTimeString([], { hour12: false })}
              </span>
              <span className="text-border">·</span>
              <span>Live</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-9 cursor-pointer gap-2 px-1.5"
                  aria-label="Account menu"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                    {displayName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-emerald-400" />
                    Authorized operator
                  </div>
                  <div className="mt-1 truncate text-sm font-medium text-foreground">
                    {displayName}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
