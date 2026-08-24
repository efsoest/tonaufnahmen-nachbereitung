# Developer & Agent Guidelines

This document outlines the architectural guidelines, conventions, workflows, and standards for the `tonaufnahmen-nachbereitung` repository.

---

## 1. Language & Localization Conventions

- **Git Commits & PRs:** **English only** (using Conventional Commits).
- **Source Code & Documentation:** **English** (variable names, types, functions, docstrings, tests, architecture docs).
- **User Interface & CLI Messages:** **German** (`console.log`, inquirer prompts, error hints, confirmations).
  - _Rationale:_ The end users are German-speaking church technicians and volunteers.
  - File tags & brackets also follow church domain vocabulary in German (e.g. `[Botschaft]`, `[Lied]`, `[Begrüßung]`).

---

## 2. Git Commit Conventions (Conventional Commits)

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification in **English**:

### Format

```text
<type>: <short imperative summary in English> (#issue-number)

- Optional detailed bullet points in English
- Further context or architectural notes
```

### Allowed Types

- `feat`: New user-facing feature or CLI workflow.
- `fix`: Bug fix in processing, tagging, or CLI.
- `refactor`: Code restructuring without functional or user-visible changes.
- `chore`: Build config, deployment script, dependencies, `.gitignore`.
- `docs`: Documentation updates (`README.md`, `AGENTS.md`, docstrings).
- `test`: Adding or updating unit/E2E test suites.

### Examples

- `feat: add session autosave and resume for multi-file processing (#7)`
- `fix: use fully uppercase replacements for uppercase umlauts`
- `refactor: extract shared filename validation prompt helper`
- `chore: update target directory path in deployment script`

---

## 3. Technology Stack & Tooling

- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **Language:** TypeScript (Strict mode, ESNext)
- **CLI Prompts:** `@inquirer/prompts`
- **ID3 Tagging:** `node-id3`
- **Config Parser:** `yaml`

### Essential Commands

```bash
# Install dependencies
bun install

# Run application locally
bun run start

# Format code with Prettier
bun run format:write

# TypeScript Typecheck (must pass with 0 errors)
bun run typecheck

# Run test suite
bun test

# Build Windows portable executable
bun run export

# Build and deploy to target Synology Drive
bun run deploy
```

---

## 4. Testing & Local Test Environment

- **Test Runner:** `bun:test`
- **Unit Tests:** Co-located next to implementation files (e.g. `src/session.test.ts`, `src/tagger.test.ts`, `src/utils.test.ts`).
- **E2E Tests:** `src/e2e.test.ts` simulates complete event lifecycle with synthetic MP3s and directory structures.

### Local Test Sandbox

To test interactively without touching real church production files:

```bash
# 1. Reset/generate fake event directory in ./test-env/ and create config.test.yml
bun run test:setup

# 2. Run CLI in test mode against config.test.yml
bun run test:dev
```

---

## 5. Architectural & Design Principles

1. **Modular Separation in `src/`:**
   - `types.ts`: TypeScript interfaces and domain types.
   - `config.ts`: YAML configuration loader with fallback resolution.
   - `utils.ts`: Date parsing, directory discovery, Windows-safe filename sanitization.
   - `tagger.ts`: ID3 tag writing and standardized filename generation.
   - `wizard.ts`: Interactive inquirer CLI prompts, input validations, and recovery dialogs.
   - `session.ts`: Session caching, persistence, and cleanup (`.session.json`).
   - `index.ts`: Application orchestrator and main execution flow.

2. **Windows Path & Filename Safety:**
   - Windows forbids `< > : " / \ | ? *`. Always validate inputs with `validateFilenameInput` and sanitize with `makeSafeFilename`.
   - German umlauts in filenames are converted to uppercase ASCII equivalents (`Ä` -> `AE`, `Ö` -> `OE`, `Ü` -> `UE`, `ß` -> `SS`).
   - Output titles and folder names are consistently formatted in uppercase.

3. **Session Caching & Crash Protection:**
   - For multi-file events (`isMultiple`), metadata must be auto-saved after each file into `<mixdownDir>/.session.json`.
   - On resume, already recorded tracks are skipped directly to avoid re-entry fatigue.
   - In edit mode, previous values are offered as defaults.
   - The session file must be deleted upon successful completion.

4. **Graceful Termination:**
   - When running on Windows (double-click on `.exe`), the console window closes immediately when the process exits.
   - Always terminate using `waitForKeyPressAndExit` on fatal errors or completion so the user can read console output before the window closes.
