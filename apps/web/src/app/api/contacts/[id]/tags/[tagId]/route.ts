import type { NextRequest } from "next/server";
import { forward } from "@/lib/proxy";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> },
) {
  const { id, tagId } = await params;
  return forward(
    req,
    `/contacts/${encodeURIComponent(id)}/tags/${encodeURIComponent(tagId)}`,
    "DELETE",
  );
}
