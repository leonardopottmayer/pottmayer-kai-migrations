import { Client } from "pg";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: join(process.cwd(), ".env") });

export function getClient() {
  console.log({ path: join(process.cwd(), ".env") });
  const { PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE } = process.env;

  if (!PG_HOST || !PG_PORT || !PG_USER || !PG_PASSWORD || !PG_DATABASE) {
    console.error("❌ Environment variables are not defined correctly.");
    process.exit(1);
  }

  return new Client({
    host: PG_HOST,
    port: parseInt(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: PG_DATABASE,
    application_name: "kai-cli",
  });
}
