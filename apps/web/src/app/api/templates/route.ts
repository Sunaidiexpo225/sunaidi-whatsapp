import type { NextRequest } from "next/server";
import { forward } from "@/lib/proxy";

export async function POST(req: NextRequest) {
  return forward(req, "/templates", "POST");
}
