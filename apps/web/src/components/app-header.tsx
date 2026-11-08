"use client";

import { useRouter } from "next/navigation";
import { NavLinks } from "./nav-links";

export function AppHeader() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-brand px-4 py-3 text-white">
      <h1 className="text-lg font-semibold">Sunaidi WhatsApp</h1>
      <NavLinks />
      <button
        onClick={logout}
        className="ml-auto rounded px-3 py-1 text-sm text-white/80 hover:bg-white/10"
      >
        Sign out
      </button>
    </header>
  );
}
