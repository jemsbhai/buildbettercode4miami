import { handlePublicCommand } from "@/lib/public/command";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) { return handlePublicCommand(request); }
