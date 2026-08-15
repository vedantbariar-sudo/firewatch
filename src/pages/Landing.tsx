import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FireMap } from "@/components/map/FireMap";
import { incidentApi } from "@/lib/api";
import { RISK_META } from "@/lib/status";
import type { FireIncident } from "@/types";
import logo from "@/assets/logo.svg";
import {
  ArrowRight,
  Flame,
  Route,
  Satellite,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how" },
];

const FEATURES = [
  {
    icon: Satellite,
    title: "See where the fire is",
    body: "A live map shows the fire, the areas at risk, and how the fire is expected to spread over the next day.",
  },
  {
    icon: Route,
    title: "Know your route",
    body: "The safest evacuation route is picked for you, and updated automatically as the fire moves.",
  },
  {
    icon: Wind,
    title: "Weather in plain words",
    body: "Wind, heat, and humidity are explained simply, so everyone understands what is driving the fire.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "We watch",
    body: "Satellite images and weather data are checked around the clock.",
  },
  {
    step: "02",
    title: "We predict",
    body: "A model shows where the fire is most likely to go over the next 24 hours.",
  },
  {
    step: "03",
    title: "You know what to do",
    body: "Clear routes and alerts reach you before the fire does.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [incident, setIncident] = useState<FireIncident | null>(null);

  useEffect(() => {
    incidentApi.getIncident("ridge-fire").then(setIncident);
  }, []);

  const launch = () => navigate("/auth?returnTo=/dashboard");
  const browse = () => navigate("/auth?returnTo=/incidents");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background text-foreground"
    >
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="FireWatch logo" className="size-8 rounded-lg" />
            <span className="text-[15px] font-semibold tracking-tight">
              FireWatch
            </span>
            <span className="ml-1 hidden rounded-full border border-border/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              Wildfire response
            </span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="cursor-pointer"
              onClick={() => navigate("/auth")}
            >
              Sign in
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={launch}
            >
              See the live map
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_60%)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-28 lg:px-6 lg:pt-36">
            <div className="mx-auto max-w-3xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-sm font-medium text-orange-400">
                  <span className="size-1.5 animate-pulse rounded-full bg-orange-400" />
                  Live wildfire information · demo data
                </span>
                <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                  Know where the fire is going{" "}
                  <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                    before it gets there.
                  </span>
                </h1>
                <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  FireWatch shows you where a wildfire is, where it is heading,
                  and the safest way out — updated as conditions change.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="cursor-pointer"
                    onClick={launch}
                  >
                    See the live map
                    <ArrowRight className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={browse}
                  >
                    Browse fires
                  </Button>
                </div>
              </motion.div>
            </div>

            {/* Map preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mx-auto mt-14 max-w-4xl"
            >
              <div className="overflow-hidden rounded-2xl border border-border/70 shadow-2xl shadow-black/50">
                {incident ? (
                  <FireMap
                    incident={incident}
                    stepIndex={1}
                    interactive={false}
                    showLegend={false}
                    className="h-[340px] rounded-none border-0 sm:h-[420px]"
                  />
                ) : (
                  <Skeleton className="h-[340px] w-full rounded-none sm:h-[420px]" />
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-card/60 px-4 py-2.5 text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Flame className="size-3.5 text-orange-400" />
                    Ridge Fire — Lake Arrowhead, CA
                  </span>
                  <span className="flex items-center gap-3 text-muted-foreground">
                    <span>Containment 12%</span>
                    <span className="text-border">·</span>
                    <span>Wind NE 32 km/h</span>
                    <span className="text-border">·</span>
                    <span className="font-medium text-rose-400">
                      {RISK_META.extreme.label} risk
                    </span>
                  </span>
                </div>
              </div>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                A live look at the fire map — where the fire is, where it is
                going, and the best way out.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-4 py-8 sm:grid-cols-4 lg:px-6">
            {[
              { value: "24 hours", label: "Forecast window" },
              { value: "3", label: "Fires tracked" },
              { value: "4,820", label: "Acres being tracked" },
              { value: "2", label: "Shelters ready" },
            ].map((stat) => (
              <div key={stat.label} className="px-4 py-2 text-center">
                <p className="text-2xl font-semibold tabular-nums tracking-tight">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-400">
              The product
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              A clear picture, for everyone.
            </h2>
            <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
              The map, the routes, and the alerts — designed to be easy to
              understand at a glance.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border/70 bg-card/50 p-5 transition-colors hover:border-border"
              >
                <span className="flex size-9 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/10 text-orange-400">
                  <feature.icon className="size-4" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-y border-border/60 bg-card/40">
          <div className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:px-6">
            <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-wide text-orange-400">
              How it works
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              From the satellite to your front door.
            </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((item) => (
                <div key={item.step} className="rounded-xl border border-border/70 bg-background/60 p-6">
                  <p className="font-mono text-xs font-semibold text-orange-400">
                    {item.step}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-7 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 lg:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-[#1a120b] via-card to-[#0b0f16] px-6 py-14 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.12),transparent_65%)]"
            />
            <h2 className="relative text-3xl font-semibold tracking-tight">
              See it for yourself.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-[15px] leading-7 text-muted-foreground">
              Open the live map and watch the forecast in motion — where the
              fire is going and the safest way out.
            </p>
            <Button
              type="button"
              size="lg"
              className="relative mt-7 cursor-pointer"
              onClick={launch}
            >
              Open the live map
              <ArrowRight className="size-4" />
            </Button>
            <p className="relative mt-4 text-xs text-muted-foreground/80">
              Demo only — all data is simulated. FireWatch is not an emergency
              service.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row lg:px-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="FireWatch logo" className="size-6 rounded-md" />
            <span className="text-sm font-semibold tracking-tight">
              FireWatch
            </span>
            <span className="text-xs text-muted-foreground">
              · Wildfire Response System
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Simulated data for demonstration purposes
          </p>
          <p className="text-xs text-muted-foreground">© 2026 FireWatch</p>
        </div>
      </footer>
    </motion.div>
  );
}
