import fs from "fs";
import path from "path";
import { KaiError } from "./errors";

export interface EnvironmentConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface KaiConfig {
  environments: Record<string, EnvironmentConfig>;
}

/**
 * Loads the config for a given environment from config.json in the current
 * working directory. Values can be overridden via environment variables:
 *   KAI_DB_HOST, KAI_DB_PORT, KAI_DB_USER, KAI_DB_PASSWORD, KAI_DB_DATABASE
 */
export function loadConfig(environment: string): EnvironmentConfig {
  const configPath = path.join(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    throw new KaiError(
      `config.json not found in the current directory.\nRun "kai init" to create a template.`
    );
  }

  let parsed: KaiConfig;
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    parsed = JSON.parse(raw) as KaiConfig;
  } catch {
    throw new KaiError("config.json is not valid JSON.");
  }

  const envConfig = parsed.environments?.[environment];
  if (!envConfig) {
    const available = Object.keys(parsed.environments ?? {}).join(", ") || "none";
    throw new KaiError(
      `Environment "${environment}" not found in config.json.\nAvailable environments: ${available}`
    );
  }

  return {
    host: process.env["KAI_DB_HOST"] ?? envConfig.host,
    port: Number(process.env["KAI_DB_PORT"] ?? envConfig.port),
    user: process.env["KAI_DB_USER"] ?? envConfig.user,
    password: process.env["KAI_DB_PASSWORD"] ?? envConfig.password,
    database: process.env["KAI_DB_DATABASE"] ?? envConfig.database,
  };
}
