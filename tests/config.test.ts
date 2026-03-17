import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadConfig } from "../src/config";
import { KaiError } from "../src/errors";

// Each test gets an isolated temporary directory.
function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kai-test-"));
}

describe("loadConfig", () => {
  let tmpDir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

    // Clean ENV overrides before each test.
    delete process.env["KAI_DB_HOST"];
    delete process.env["KAI_DB_PORT"];
    delete process.env["KAI_DB_USER"];
    delete process.env["KAI_DB_PASSWORD"];
    delete process.env["KAI_DB_DATABASE"];
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeConfig(data: object): void {
    fs.writeFileSync(path.join(tmpDir, "config.json"), JSON.stringify(data));
  }

  it("throws KaiError when config.json does not exist", () => {
    expect(() => loadConfig("dev")).toThrow(KaiError);
    expect(() => loadConfig("dev")).toThrow(/config\.json not found/);
  });

  it("throws KaiError when config.json is invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, "config.json"), "{ not valid json }");
    expect(() => loadConfig("dev")).toThrow(KaiError);
    expect(() => loadConfig("dev")).toThrow(/not valid JSON/);
  });

  it("throws KaiError when environment is not defined", () => {
    writeConfig({ environments: { prod: { host: "h", port: 5432, user: "u", password: "p", database: "d" } } });
    expect(() => loadConfig("dev")).toThrow(KaiError);
    expect(() => loadConfig("dev")).toThrow(/"dev" not found/);
  });

  it("lists available environments in the error message", () => {
    writeConfig({ environments: { staging: { host: "h", port: 5432, user: "u", password: "p", database: "d" } } });
    let caught: KaiError | undefined;
    try {
      loadConfig("dev");
    } catch (e) {
      caught = e as KaiError;
    }
    expect(caught?.message).toContain("staging");
  });

  it("returns the correct values from config.json", () => {
    writeConfig({
      environments: {
        dev: { host: "localhost", port: 5432, user: "admin", password: "secret", database: "mydb" },
      },
    });
    const cfg = loadConfig("dev");
    expect(cfg).toEqual({ host: "localhost", port: 5432, user: "admin", password: "secret", database: "mydb" });
  });

  it("supports multiple environments", () => {
    writeConfig({
      environments: {
        dev: { host: "dev-host", port: 5432, user: "u", password: "p", database: "dev_db" },
        prod: { host: "prod-host", port: 5433, user: "u2", password: "p2", database: "prod_db" },
      },
    });
    expect(loadConfig("dev").host).toBe("dev-host");
    expect(loadConfig("prod").host).toBe("prod-host");
  });

  describe("ENV variable overrides", () => {
    beforeEach(() => {
      writeConfig({
        environments: {
          dev: { host: "config-host", port: 5432, user: "config-user", password: "config-pass", database: "config-db" },
        },
      });
    });

    it("KAI_DB_HOST overrides host", () => {
      process.env["KAI_DB_HOST"] = "env-host";
      expect(loadConfig("dev").host).toBe("env-host");
    });

    it("KAI_DB_PORT overrides port and is cast to number", () => {
      process.env["KAI_DB_PORT"] = "5433";
      expect(loadConfig("dev").port).toBe(5433);
    });

    it("KAI_DB_USER overrides user", () => {
      process.env["KAI_DB_USER"] = "env-user";
      expect(loadConfig("dev").user).toBe("env-user");
    });

    it("KAI_DB_PASSWORD overrides password", () => {
      process.env["KAI_DB_PASSWORD"] = "env-pass";
      expect(loadConfig("dev").password).toBe("env-pass");
    });

    it("KAI_DB_DATABASE overrides database", () => {
      process.env["KAI_DB_DATABASE"] = "env-db";
      expect(loadConfig("dev").database).toBe("env-db");
    });

    it("ENV overrides take precedence over config values", () => {
      process.env["KAI_DB_HOST"] = "override";
      const cfg = loadConfig("dev");
      expect(cfg.host).toBe("override");
      expect(cfg.user).toBe("config-user"); // non-overridden value stays
    });

    it("falls back to config values when ENV vars are not set", () => {
      const cfg = loadConfig("dev");
      expect(cfg.host).toBe("config-host");
      expect(cfg.password).toBe("config-pass");
    });
  });
});
