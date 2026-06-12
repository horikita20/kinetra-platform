import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KinectraLogo } from "./KinectraLogo";

const SECTIONS = [
  { label: "Home", id: "hero", type: "scroll" },
  { label: "How It Works", id: "how-it-works", type: "scroll" },
  { label: "Demo", id: "demo", type: "scroll" },
  { label: "Analysis", id: "analysis", path: "/setup", type: "link" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("hero");
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const isHome = location === "/";

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 24);
      
      if (!isHome) {
        if (location === "/setup") {
          setActive("analysis");
        }
        return;
      }

      const ids = ["demo", "how-it-works", "hero"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            setActive(id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    // Call handler initially to set state based on URL
    handler();
    return () => window.removeEventListener("scroll", handler);
  }, [location, isHome]);

  const handleNav = (item: typeof SECTIONS[0]) => {
    setMenuOpen(false);
    if (item.type === "scroll") {
      if (isHome) {
        document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setLocation(`/#${item.id}`);
        // Wait for page transition to scroll
        setTimeout(() => {
          document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } else if (item.path) {
      setLocation(item.path);
    }
  };

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled || !isHome
          ? "bg-white/95 backdrop-blur-lg shadow-sm border-b border-border/60"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group select-none">
          <KinectraLogo className="w-9 h-9 transition-transform group-hover:scale-105" />
          <span className="font-bold tracking-tight text-foreground text-[17px]">KINETRA</span>
        </Link>

        {/* Desktop Nav Items */}
        <div className="hidden md:flex items-center gap-1">
          {SECTIONS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item)}
                className={`relative px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary/10 rounded-lg"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right side CTA */}
        <div className="flex items-center gap-2">
          {!isHome && (
            <Link href="/">
              <button className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50 font-medium">
                ← Back
              </button>
            </Link>
          )}
          <Link href="/setup">
            <Button size="sm" className="shadow-md font-bold text-xs uppercase tracking-wider h-9 px-4">
              Start Analysis
            </Button>
          </Link>
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-white/95 backdrop-blur-md border-b border-border/50"
          >
            <div className="container mx-auto px-4 py-2 flex flex-col gap-1">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNav(item)}
                  className="text-left px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
