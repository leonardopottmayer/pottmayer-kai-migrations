import { Client } from "pg";
const fs = require("fs");
const path = require("path");

export function getClient(environment: string): Client {
  const configPath = path.join(process.cwd(), "config.json");

  if (!fs.existsSync(configPath)) {
    console.error("❌ config.json not found in current directory.");
    process.exit(1);
  }

  const raw = fs.readFileSync(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const envConfig = parsed.environments?.[environment];

  if (!envConfig) {
    console.error(`❌ Environment '${environment}' not found in config.json.`);
    process.exit(1);
  }

  const { host, port, user, password, database } = envConfig;

  return new Client({
    host,
    port,
    user,
    password,
    database,
    application_name: `kai-cli-${environment}`,
  });
}
