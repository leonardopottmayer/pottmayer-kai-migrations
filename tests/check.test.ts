import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { checkMigrations } from "../src/commands/check";
import { KaiError } from "../src/errors";
import { setJsonMode } from "../src/logger";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kai-check-test-"));
}

describe("checkMigrations", () => {
  let tmpDir: string;
  let migrationsDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    migrationsDir = path.join(tmpDir, "migrations");
    fs.mkdirSync(migrationsDir);
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    setJsonMode(false);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
    setJsonMode(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function makeConnectSpy(appliedIds: string[]) {
    const dbModule = await import("../src/db");
    const mockClient = {
      query: vi.fn().mockResolvedValue({
        rows: appliedIds.map((id) => ({ migration_id: id })),
      }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    const spy = vi.spyOn(dbModule, "createConnectedClient").mockResolvedValue(mockClient as never);
    return { spy, mockClient };
  }

  function createMigrationFolder(name: string) {
    const dir = path.join(migrationsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${name}.up.sql`), "SELECT 1;");
    fs.writeFileSync(path.join(dir, `${name}.down.sql`), "SELECT 0;");
  }

  it("throws KaiError when migrations/ directory does not exist", async () => {
    fs.rmSync(migrationsDir, { recursive: true });
    await expect(checkMigrations("dev")).rejects.toThrow(KaiError);
  });

  it("does not call process.exit(2) when all migrations are applied", async () => {
    createMigrationFolder("20250101000000-users");
    const { spy } = await makeConnectSpy(["20250101000000-users"]);

    await checkMigrations("dev");

    expect(exitSpy).not.toHaveBeenCalledWith(2);
    spy.mockRestore();
  });

  it("calls process.exit(2) when there are pending migrations", async () => {
    createMigrationFolder("20250101000000-users");
    const { spy } = await makeConnectSpy([]); // nothing applied

    await checkMigrations("dev");

    expect(exitSpy).toHaveBeenCalledWith(2);
    spy.mockRestore();
  });

  it("logs success message when up to date", async () => {
    createMigrationFolder("20250101000000-users");
    const { spy } = await makeConnectSpy(["20250101000000-users"]);

    await checkMigrations("dev");

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("up to date");
    spy.mockRestore();
  });

  it("outputs pending migration names when not up to date", async () => {
    createMigrationFolder("20250101000000-users");
    const { spy } = await makeConnectSpy([]);

    await checkMigrations("dev");

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("20250101000000-users");
    spy.mockRestore();
  });

  it("correctly identifies which migrations are pending", async () => {
    createMigrationFolder("20250101000000-users");
    createMigrationFolder("20250101000001-orders");
    const { spy } = await makeConnectSpy(["20250101000000-users"]); // only first applied

    await checkMigrations("dev");

    const output = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(output).not.toContain("20250101000000-users");
    expect(output).toContain("20250101000001-orders");
    spy.mockRestore();
  });

  describe("--json mode", () => {
    it("outputs valid JSON with pending_count and pending array", async () => {
      setJsonMode(true);
      createMigrationFolder("20250101000000-users");
      const { spy } = await makeConnectSpy([]);

      await checkMigrations("dev");

      const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      const parsed = JSON.parse(written);
      expect(parsed).toHaveProperty("pending_count", 1);
      expect(parsed).toHaveProperty("pending");
      expect(parsed.pending).toContain("20250101000000-users");
      spy.mockRestore();
    });

    it("JSON shows pending_count 0 when up to date", async () => {
      setJsonMode(true);
      createMigrationFolder("20250101000000-users");
      const { spy } = await makeConnectSpy(["20250101000000-users"]);

      await checkMigrations("dev");

      const written = stdoutSpy.mock.calls.map((c) => c[0]).join("");
      const parsed = JSON.parse(written);
      expect(parsed.pending_count).toBe(0);
      spy.mockRestore();
    });
  });
});
