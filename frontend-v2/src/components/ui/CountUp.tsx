import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  to: number | string;
  duration?: number;
  suffix?: string;
}

/* Animates a number from 0 → target over `duration` ms */
export function CountUp({ to, duration = 700, suffix = "" }: CountUpProps) {
  const [display, setDisplay] = useState<string | number>(typeof to === "string" ? to : 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof to === "string") { setDisplay(to); return; }
    const start = performance.now();
    const from = 0;
    const range = to - from;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + range * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [to, duration]);

  return <>{display}{suffix}</>;
}
