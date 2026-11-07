# Shared development environment

`feature/frontend-base` establishes one root workspace for the team. Use exactly **Node 24.19.0** and **npm 12.0.2** in both native and container development. Direct dependencies are pinned to the existing lockfile versions; installing is not an upgrade operation.

## VS Code devcontainer (primary workflow)

Host prerequisites:

- VS Code with Microsoft's **Dev Containers** extension (`ms-vscode-remote.remote-containers`).
- A running Docker-compatible engine using Linux containers. Docker Desktop provides this on macOS and Windows; Docker Engine or Docker Desktop works on Linux.
- On Windows, enable WSL2 and Docker Desktop's WSL integration. Prefer cloning into the WSL Linux filesystem and opening the folder through VS Code's WSL extension to improve file watching and filesystem performance.
- Git to clone the repository, or use VS Code's **Clone Repository in Container Volume** command. Node and npm are supplied inside the container.

Open your clone in VS Code, switch to `feature/frontend-base`, then run **Dev Containers: Reopen in Container** from the Command Palette. The first build downloads the image and tools, creates isolated volumes, and runs `npm ci`. Later container creation repeats the installation against the lockfile.

In the container terminal:

```sh
npm run check:toolchain
npm run dev
```

Open **Tidepath** on port 3000 in VS Code's **Ports** panel. The server listens on container loopback; VS Code forwards it to host localhost. Do not use Docker `-p` with the loopback-bound server. If local port 3000 is occupied, use the actual forwarded address shown in the Ports panel. Server startup is manual, so reopening the workspace does not start extra servers.

The image selects `linux/arm64` on ARM machines and `linux/amd64` on x86-64 machines. No emulation is forced. The `node` user runs terminals, installs, and application commands; Git, Bash, curl, ripgrep and less are available. VS Code's built-in TypeScript support uses the workspace compiler.

No personal configuration mounts, host Docker socket, API keys or `.env.local` are required. The default fictional demo works without credentials. Git authentication remains a contributor-specific host setup; this configuration does not install keys.

## Native development

Install Node **24.19.0** with your preferred version manager or the matching official installer, and install npm **12.0.2**. `.nvmrc` selects Node for tools that support it; `.npmrc` enforces install policy and does not install or switch Node.

With an existing Unix `nvm` installation:

```sh
nvm install
nvm use
npm install --global npm@12.0.2
npm ci
npm run dev
```

With an existing nvm-windows installation (PowerShell):

```powershell
nvm install 24.19.0
nvm use 24.19.0
npm install --global npm@12.0.2
npm ci
npm run dev
```

The optional `powershell -File scripts/dev.ps1 -Port 3000` launcher checks the same versions. It no longer searches machine-specific application caches for Node. Use a PowerShell execution policy appropriate to your machine; invoking `npm.cmd` directly is also an option if PowerShell blocks npm's `.ps1` shim.

`engines`, `devEngines`, the `packageManager` declaration and the preinstall checker describe/enforce the supported setup. A wrong Node/npm version should fail with an error. Yarn, pnpm and Bun are not supported installers. Do not bypass checks with `--force` or `--ignore-scripts` as a setup workaround.

## Dependencies, rebuilds and switching workflows

Source is shared with the host. Container `node_modules` and `.next` use workspace-specific Docker volumes; native installations/builds remain in the host checkout. TypeScript's incremental cache lives under `.next/cache` so it is isolated too. Never copy dependency directories between operating systems or architectures. `.data/state.json` remains in the checkout and persists across container rebuilds.

- After pulling a changed lockfile, run `npm ci` in each workflow you use. Reopening an existing container does not automatically reinstall dependencies.
- After changing the Dockerfile or devcontainer configuration, run **Dev Containers: Rebuild Container**. Existing dependency/build volumes survive a rebuild.
- To clear stale build output, stop the server and remove only the contents of `.next` in the affected workflow. Do not remove the mounted directory itself.
- For an intentional package change, use `npm install <package>@<exact-version>` (or `--save-dev`), review both manifests, and run `npm run verify`. `save-exact=true` keeps new direct versions exact.
- npm 12 blocks unapproved dependency lifecycle scripts. The reviewed `esbuild@0.28.2` installer is allowed for binary setup/validation. The optional macOS `fsevents` package ships its binary; its implicit rebuild is denied. Review scripts before using `npm install-scripts approve <package>`; approvals are version-specific. Do not approve every dependency automatically.
- Update Node/npm declarations in `package.json`, `.nvmrc`, the Dockerfile, CI bootstrap, and this guide together. Update the Docker image's **multi-architecture index digest**, rather than selecting an architecture-specific child digest.

Keep platform-specific optional lockfile entries. Regenerate dependency changes from a complete lockfile and check both architecture jobs; never remove other platforms' packages to make a local installation look smaller.

## Validation

From a native or container terminal:

```sh
npm run verify
```

This checks the toolchain, typechecks, runs the existing tests, builds production output, starts a production server on port **3210**, and runs the deterministic HTTP smoke suite. It uses a temporary state file and disables live credentials, stops its server, and deletes that temporary state afterward. Port 3210 must be free; the verifier refuses to use an already-running server. Builds and the development server can coexist because Next.js keeps development output under `.next/dev`.

For container automation without VS Code, install the pinned CLI outside the project (or use the pinned one-off invocation below):

```sh
npx --yes @devcontainers/cli@0.90.0 up --workspace-folder .
npx --yes @devcontainers/cli@0.90.0 exec --workspace-folder . npm run verify
```

The GitHub **Development baseline** workflow uses that CLI to create the actual devcontainer and verify it on native Linux ARM64 and x86-64 runners. It also checks architecture, non-root execution, utilities, writable directories, and that validation leaves tracked files unchanged. It runs on pull requests, pushes to `feature/frontend-base`, and manual dispatch. Checks require no repository secrets or live model calls.

When recording results, distinguish native host checks, native Linux containers, emulated containers, hosted CI and interactive VS Code testing. A successful image build or manifest inspection alone does not prove application compatibility. See [verification records](VERIFICATION.md) for the evidence collected so far.
