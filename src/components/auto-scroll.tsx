"use client";

import { useEffect } from "react";

/** Scrolls to the element with the given id on mount. Renders nothing. */
export function AutoScroll({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [id]);
  return null;
}
