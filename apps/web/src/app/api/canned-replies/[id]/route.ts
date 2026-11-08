import type { NextRequest } from "next/server";
import { forward } from "@/lib/proxy";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forward(req, `/canned-replies/${encodeURIComponent(id)}`, "DELETE");
}
