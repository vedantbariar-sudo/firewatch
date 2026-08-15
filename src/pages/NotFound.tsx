import { motion } from "framer-motion";
import { Link } from "react-router";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col bg-background text-foreground"
    >
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <Flame className="size-8 text-orange-500" />
        <h1 className="mt-5 text-5xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          This page is outside the incident area.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex h-9 items-center rounded-md border border-border/70 bg-background/60 px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Back to FireWatch
        </Link>
      </div>
    </motion.div>
  );
}
