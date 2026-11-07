import { TidepathDashboard } from "@/components/dashboard";
import { PublicHome } from "@/components/public-site";

export default function Page() {
  return process.env.TIDEPATH_PUBLIC_SERVICE === "1" || process.env.VERCEL ? <PublicHome /> : <TidepathDashboard />;
}
