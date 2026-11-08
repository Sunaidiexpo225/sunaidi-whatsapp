import type { NextRequest } from "next/server";
import { forward } from "@/lib/proxy";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(req, `/automations/${encodeURIComponent(id)}/config`, "PATCH");
}
