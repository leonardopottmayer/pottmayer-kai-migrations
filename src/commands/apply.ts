const { getClient } = require("../db");
const fs = require("fs");
const path = require("path");

export async function applyMigrations() {
  const migrationsDir = path.join(process.cwd(), "migrations");
  const folders = fs.readdirSync(migrationsDir).sort();

  const invalidFolders: string[] = [];

  for (const folder of folders) {
    const base = path.join(migrationsDir, folder);
    const up = path.join(base, `${folder}.up.sql`);
    const down = path.join(base, `${folder}.down.sql`);

    if (!fs.existsSync(up) || !fs.existsSync(down)) {
      invalidFolders.push(folder);
    }
  }

  if (invalidFolders.length > 0) {
    console.error("❌ The following migrations are incomplete or malformed:");
    invalidFolders.forEach((f) => console.error(` - ${f}`));
    console.error("🚫 Aborting apply.");
    return;
  }

  const client = getClient();
  await client.connect();

  const { rows: batchRows } = await client.query(
    `SELECT MAX(application_batch_id) AS max FROM migrations`
  );

  const currentBatch = batchRows[0]?.max ?? 0;
  const newBatch = currentBatch + 1;

  for (const folder of folders) {
    const migrationId = folder;

    const { rowCount } = await client.query(
      `SELECT 1 FROM migrations WHERE migration_id = $1 AND status = 'A'`,
      [migrationId]
    );
    if ((rowCount ?? 0) > 0) continue;

    const upSql = fs.readFileSync(
      path.join(migrationsDir, folder, `${folder}.up.sql`),
      "utf8"
    );

    try {
      await client.query("BEGIN");
      await client.query(upSql);

      await client.query(
        `INSERT INTO migrations (migration_id, status, updated_at, application_batch_id)
         VALUES ($1, 'A', NOW(), $2)
         ON CONFLICT (migration_id)
         DO UPDATE SET status = 'A', updated_at = NOW(), application_batch_id = $2`,
        [migrationId, newBatch]
      );

      await client.query("COMMIT");
      console.log(`✅ Applied ${migrationId}`);
    } catch (err: any) {
      await client.query("ROLLBACK");

      await client.query(
        `INSERT INTO migrations (migration_id, status)
         VALUES ($1, 'E')
         ON CONFLICT (migration_id) DO UPDATE SET status = 'E'`,
        [migrationId]
      );

      console.error(`❌ Failed to apply ${migrationId}:`, err.message);
      break;
    }
  }

  await client.end();
}
