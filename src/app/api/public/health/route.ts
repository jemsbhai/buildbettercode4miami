import { json } from "@/lib/public/http";
export async function GET() { return json({ service: "tidepath-sheets", status: "ok", installation: "pending_google_review" }); }
