const { getClient } = require("../db");
const fs = require("fs");

export async function showMigrationStatus() {
  const client = getClient();
  await client.connect();

  const batchesRes = await client.query(`
    SELECT DISTINCT application_batch_id
    FROM migrations
    WHERE application_batch_id IS NOT NULL
    ORDER BY application_batch_id DESC
    LIMIT 5
  `);

  const batches = batchesRes.rows.map((row) => row.application_batch_id);

  if (batches.length === 0) {
    console.log("🔍 No batch found..");
    await client.end();
    return;
  }

  const res = await client.query(
    `SELECT migration_id, status, application_batch_id
     FROM migrations
     WHERE application_batch_id = ANY($1::int[])
     ORDER BY application_batch_id DESC, migration_id`,
    [batches]
  );

  if (res.rowCount === 0) {
    console.log("🔍 No migration found on last batches..");
    await client.end();
    return;
  }

  const grouped = new Map<number, { migration_id: string; status: string }[]>();

  res.rows.forEach(({ migration_id, status, application_batch_id }) => {
    if (!grouped.has(application_batch_id))
      grouped.set(application_batch_id, []);
    grouped.get(application_batch_id)!.push({ migration_id, status });
  });

  console.log(`\n📋 Last ${batches.length} batches of migrations:\n`);
  for (const batchId of batches.sort((a, b) => b - a)) {
    const migrations = grouped.get(batchId) || [];
    console.log(`🔸 Batch ${batchId}:`);
    for (const m of migrations) {
      const symbol =
        m.status === "A"
          ? "[✓]"
          : m.status === "R"
          ? "[↩]"
          : m.status === "E"
          ? "[!]"
          : "[?]";
      console.log(`  ${symbol} ${m.migration_id}`);
    }
    console.log();
  }

  await client.end();
}
