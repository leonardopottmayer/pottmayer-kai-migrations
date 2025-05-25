import { getClient } from "../db";
const fs = require("fs");
const path = require("path");

export async function rollbackMigrations(
  envName: string,
  targetMigrationId?: string
) {
  const client = getClient(envName);
  await client.connect();

  const batchQuery = targetMigrationId
    ? `
      SELECT application_batch_id FROM migrations
      WHERE migration_id = $1
    `
    : `
      SELECT MAX(application_batch_id) AS application_batch_id
      FROM migrations
      WHERE status = 'A'
    `;

  const batchResult = targetMigrationId
    ? await client.query(batchQuery, [targetMigrationId])
    : await client.query(batchQuery);

  const batchId = batchResult.rows[0]?.application_batch_id;
  if (!batchId) {
    console.log("🚫 No batch to rollback.");
    await client.end();
    return;
  }

  const migrationResult = await client.query(
    `SELECT migration_id FROM migrations
     WHERE application_batch_id >= $1 AND status = 'A'
     ORDER BY application_batch_id DESC, migration_id DESC`,
    [batchId]
  );

  const migrations = migrationResult.rows.map((r) => r.migration_id);

  for (const migrationId of migrations) {
    const downPath = path.join(
      "migrations",
      migrationId,
      `${migrationId}.down.sql`
    );

    if (!fs.existsSync(downPath)) {
      console.error(`❌ down.sql file not found for ${migrationId}`);
      continue;
    }

    const downSql = fs.readFileSync(downPath, "utf8");

    try {
      await client.query("BEGIN");
      await client.query(downSql);
      await client.query(
        `UPDATE migrations
         SET status = 'R', updated_at = NOW()
         WHERE migration_id = $1`,
        [migrationId]
      );
      await client.query("COMMIT");
      console.log(`↩️ Rollback: ${migrationId}`);
    } catch (err: any) {
      await client.query("ROLLBACK");
      await client.query(
        `UPDATE migrations
         SET status = 'E'
         WHERE migration_id = $1`,
        [migrationId]
      );
      console.error(`❌ Failed to rollback ${migrationId}:`, err.message);
      break;
    }
  }

  await client.end();
}
