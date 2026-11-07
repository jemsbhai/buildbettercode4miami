import { getPublicStore } from "../../src/lib/public/storage";

/** Netlify only invokes scheduled functions from its scheduler or authenticated dashboard. */
export default async function publicRetention() {
  if (process.env.TIDEPATH_PUBLIC_SERVICE !== "1") {
    throw new Error("Public retention is disabled outside the public service.");
  }
  try {
    const result = await getPublicStore().purgeExpired();
    // Counts establish a successful invocation without logging identities or database errors.
    console.info(JSON.stringify({ event: "tidepath.retention.complete", deletedWorkbooks: result.deletedWorkbooks }));
  } catch {
    // Provider errors can contain connection details. Keep the scheduled-function log generic.
    throw new Error("Tidepath retention cleanup failed. Retry from the function dashboard.");
  }
}
