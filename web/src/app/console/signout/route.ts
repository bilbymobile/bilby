import type { NextRequest } from "next/server";

import { backTo } from "@/lib/console-http";
import { signOut } from "@/lib/staff";

export async function POST(req: NextRequest) {
  await signOut();
  return backTo(req, "/console/login");
}
