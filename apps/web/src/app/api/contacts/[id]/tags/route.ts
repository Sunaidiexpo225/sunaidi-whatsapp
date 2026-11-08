import type { NextRequest } from "next/server";
import { forward } from "@/lib/proxy";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(req, `/contacts/${encodeURIComponent(id)}/tags`, "POST");
}
