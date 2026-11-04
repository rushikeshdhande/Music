// src/hooks/useUserName.ts
import { useEffect } from "react";
import { useUserStore } from "../store/userStore";

export function useUserName(): string {
  const name = useUserStore((s) => s.name);
  const loaded = useUserStore((s) => s.loaded);
  const load = useUserStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  return (name ?? "").trim();
}