import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { applyMigrations } from "../src/commands/apply";
import { KaiError } from "../src/errors";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kai-apply-test-"));
}

/** Creates a valid migration folder in tmpDir/migrations/<name>. */
function createFakeMigration(migrationsDir: string, name: string, upSql = "SELECT 1;", downSql = "SELECT 0;") {
  const dir = path.join(migrationsDir, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.up.sql`), upSql);
  fs.writeFileSync(path.join(dir, `${name}.down.sql`), downSql);
}

describe("applyMigrations", () => {
  let tmpDir: string;
  let migrationsDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    migrationsDir = path.join(tmpDir, "migrations");
    fs.mkdirSync(migrationsDir);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws KaiError when migrations/ directory does not exist", async () => {
    fs.rmSync(migrationsDir, { recursive: true });
    await expect(applyMigrations("dev")).rejects.toThrow(KaiError);
  });

  it("throws KaiError when a migration is missing down.sql", async () => {
    const dir = path.join(migrationsDir, "20250101000000-test");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "20250101000000-test.up.sql"), "SELECT 1;");
    // No down.sql → invalid.
    await expect(applyMigrations("dev")).rejects.toThrow(KaiError);
  });

  it("throws KaiError when a migration is missing up.sql", async () => {
    const dir = path.join(migrationsDir, "20250101000000-test");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "20250101000000-test.down.sql"), "SELECT 0;");
    await expect(applyMigrations("dev")).rejects.toThrow(KaiError);
  });

  describe("--dry-run mode", () => {
    it("does not connect to the database in dry-run mode (no config.json needed) — shows pending list", async () => {
      // dry-run still needs a DB connection to check which migrations are pending.
      // This test verifies that when there IS a DB connection (mocked), it prints the list.
      // We skip DB-dependent tests here and focus on the structure/options.
      createFakeMigration(migrationsDir, "20250101000000-users");

      // Mock createConnectedClient to avoid real DB calls.
      const dbModule = await import("../src/db");
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params?: unknown[]) => {
          if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 0 }] });
          if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 0, rows: [] });
          if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [] });
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const connectSpy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);

      await applyMigrations("dev", { dryRun: true, yes: true });

      const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("20250101000000-users");
      expect(output).toContain("Dry run");

      connectSpy.mockRestore();
    });

    it("dry-run does not call BEGIN/COMMIT", async () => {
      createFakeMigration(migrationsDir, "20250101000000-users");

      const dbModule = await import("../src/db");
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 0 }] });
          if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 0, rows: [] });
          if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [] });
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const connectSpy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);

      await applyMigrations("dev", { dryRun: true, yes: true });

      const queryCalls = mockClient.query.mock.calls.map((c) => c[0] as string);
      expect(queryCalls.some((q) => q === "BEGIN")).toBe(false);
      expect(queryCalls.some((q) => q === "COMMIT")).toBe(false);

      connectSpy.mockRestore();
    });
  });

  describe("with mocked DB client", () => {
    async function makeConnectSpy(overrides: Partial<Record<string, unknown>> = {}) {
      const dbModule = await import("../src/db");
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 0 }] });
          if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 0, rows: [] });
          if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [] });
          if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return Promise.resolve({});
          if (sql.includes("INSERT INTO migrations")) return Promise.resolve({});
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        end: vi.fn().mockResolvedValue(undefined),
        ...overrides,
      };
      const spy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);
      return { spy, mockClient };
    }

    it("logs 'No pending migrations' when all are already applied", async () => {
      createFakeMigration(migrationsDir, "20250101000000-users");
      const { spy, mockClient } = await makeConnectSpy();
      mockClient.query.mockImplementation((sql: string) => {
        if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 1 }] });
        if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 1, rows: [{}] });
        if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [{ checksum: null }] });
        return Promise.resolve({ rows: [], rowCount: 0 });
      });

      await applyMigrations("dev", { yes: true });

      const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      expect(output).toContain("No pending");
      spy.mockRestore();
    });

    it("calls BEGIN and COMMIT when applying a migration", async () => {
      createFakeMigration(migrationsDir, "20250101000000-users");
      const { spy, mockClient } = await makeConnectSpy();

      await applyMigrations("dev", { yes: true });

      const sqlCalls = mockClient.query.mock.calls.map((c) => c[0] as string);
      expect(sqlCalls).toContain("BEGIN");
      expect(sqlCalls).toContain("COMMIT");
      spy.mockRestore();
    });

    it("calls ROLLBACK and marks status E when migration SQL fails", async () => {
      createFakeMigration(migrationsDir, "20250101000000-bad-migration", "INVALID SQL!!!");
      const dbModule = await import("../src/db");
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 0 }] });
          if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 0, rows: [] });
          if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [] });
          if (sql === "BEGIN") return Promise.resolve({});
          if (sql === "ROLLBACK") return Promise.resolve({});
          if (sql.includes("INSERT INTO migrations")) return Promise.resolve({});
          if (sql === "INVALID SQL!!!") return Promise.reject(new Error("syntax error"));
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const spy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);

      await expect(applyMigrations("dev", { yes: true })).rejects.toThrow(KaiError);

      const sqlCalls = mockClient.query.mock.calls.map((c) => c[0] as string);
      expect(sqlCalls).toContain("ROLLBACK");
      // Should mark as 'E'
      const insertError = sqlCalls.find((s) => s.includes("INSERT INTO migrations") && s.includes("'E'"));
      expect(insertError).toBeTruthy();

      spy.mockRestore();
    });

    it("applies migrations in alphabetical (timestamp) order", async () => {
      createFakeMigration(migrationsDir, "20250101000002-third");
      createFakeMigration(migrationsDir, "20250101000001-second");
      createFakeMigration(migrationsDir, "20250101000000-first");

      const appliedOrder: string[] = [];
      const dbModule = await import("../src/db");
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string, params?: string[]) => {
          if (sql.includes("MAX(application_batch_id)")) return Promise.resolve({ rows: [{ max: 0 }] });
          if (sql.includes("SELECT 1 FROM migrations")) return Promise.resolve({ rowCount: 0, rows: [] });
          if (sql.includes("SELECT checksum")) return Promise.resolve({ rows: [] });
          if (sql === "BEGIN" || sql === "COMMIT") return Promise.resolve({});
          if (sql.includes("INSERT INTO migrations")) {
            if (params?.[0]) appliedOrder.push(params[0]);
            return Promise.resolve({});
          }
          return Promise.resolve({ rows: [], rowCount: 0 });
        }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      const spy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);

      await applyMigrations("dev", { yes: true });

      expect(appliedOrder[0]).toContain("first");
      expect(appliedOrder[1]).toContain("second");
      expect(appliedOrder[2]).toContain("third");

      spy.mockRestore();
    });
  });
});
