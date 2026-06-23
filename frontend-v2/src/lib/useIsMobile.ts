import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 960px)";

function readMatch(query: string): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

export function useIsMobile(query = MOBILE_QUERY): boolean {
  const [matches, setMatches] = useState(() => readMatch(query));

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}
