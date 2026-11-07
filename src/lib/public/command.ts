import { z } from "zod";
import { authenticateAddon } from "./auth";
import { GoogleWorkbookGateway } from "./google";
import { getPublicStore, type PostgresWorkspaceStore } from "./storage";
import { json, publicError, readJson } from "./http";
import { createPublicSheetsWorkspace, executeSheetsCommand, type SheetsDependencies } from "../sheets";
import { AppError } from "../service";

const workbookSchema = z.string().regex(/^[A-Za-z0-9_-]{10,200}$/u);
const locatorSchema = z.object({ workbookId: workbookSchema, sheetId: z.number().int().nonnegative(), a1: z.string().regex(/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/u).max(40) });
const deleteSchema = z.object({ action: z.literal("delete"), workbookId: workbookSchema, confirmation: z.literal("DELETE") }).strict();
type CommandStore = Pick<PostgresWorkspaceStore, "consumeUsage" | "withWorkspace" | "deleteWorkbook">;
type CommandGateway = Pick<GoogleWorkbookGateway, "assertWorkbookAccess" | "readSelection" | "writeApprovedReport">;
export type PublicCommandDependencies = {
  authenticate?: typeof authenticateAddon;
  store?: CommandStore;
  gateway?: (accessToken: string) => CommandGateway;
  sheets?: SheetsDependencies;
};

/** Narrow production endpoint. Test dependencies replace external boundaries only. */
export async function handlePublicCommand(request: Request, dependencies: PublicCommandDependencies = {}) {
  try {
    if (request.method !== "POST") throw new AppError("Use POST for spreadsheet commands.", 405);
    // Cookies and caller-supplied account/organization metadata never authorize this route.
    if (request.headers.has("origin")) throw new AppError("Open Tidepath from the Google Sheets Extensions menu.", 403);
    const identity = await (dependencies.authenticate ?? authenticateAddon)(request.headers);
    const store = dependencies.store ?? getPublicStore();
    await store.consumeUsage(identity, "command");
    const body = await readJson(request);
    const workbookId = workbookSchema.parse(body.workbookId);
    const gateway = (dependencies.gateway ?? (token => new GoogleWorkbookGateway(token)))(request.headers.get("x-tidepath-google-access-token")!);
    await gateway.assertWorkbookAccess(workbookId);
    if (body.action === "delete") {
      if (body.confirmation !== "DELETE") throw new AppError("Confirm deletion by typing DELETE.");
      deleteSchema.parse(body);
      await store.deleteWorkbook(identity, workbookId);
      return json({ deleted: true, identity: { email: identity.email } });
    }
    if (body.action === "reset") throw new AppError("Use Delete workbook data in your account controls.", 400);
    const { workbookId: _workbookId, ...input } = body;
    if (input.action === "generate") {
      if (input.aiConsent !== undefined && typeof input.aiConsent !== "boolean") throw new AppError("AI consent must be an explicit yes or no.");
      if (input.mode === "live" && input.aiConsent !== true) throw new AppError("Review and accept the AI data disclosure before generating a report.");
      delete input.aiConsent;
    }
    const result = await store.withWorkspace(identity, workbookId, () => createPublicSheetsWorkspace(workbookId), async (workspace, checkpoint) => {
      if (workspace.workbookId !== workbookId || workspace.mode !== "public" || workspace.state.reportScope !== "donations") throw new AppError("The stored workspace could not be verified. Contact support.", 409);
      let selection;
      if (input.action !== "status") {
        const locator = locatorSchema.parse(input.selection);
        if (locator.workbookId !== workbookId) throw new AppError("The selected table belongs to another workbook.", 403);
        selection = await gateway.readSelection(locator);
        input.selection = selection; // Values, formulas and names are always re-read through the verified Google token.
      }
      const engineDependencies: SheetsDependencies = { ...dependencies.sheets, checkpoint,
        beforeGeneration: async (current, command) => {
          // A deleted/replaced lease fails before spending AI budget or sending model data.
          await checkpoint(current);
          if (command.mode === "live") await store.consumeUsage(identity, "generation");
          await dependencies.sheets?.beforeGeneration?.(current, command);
        } };
      if (input.action === "write") {
        const exported = await executeSheetsCommand(workspace, { ...input, action: "export" }, engineDependencies);
        if (!exported.export || !selection) throw new AppError("Approve a current report before writing it.", 409);
        const write = await gateway.writeApprovedReport(identity, selection, exported.export, () => checkpoint(workspace));
        return { ...exported, write };
      }
      return executeSheetsCommand(workspace, input, engineDependencies);
    });
    return json({ ...result, identity: { email: identity.email } });
  } catch (error) { return publicError(error); }
}
