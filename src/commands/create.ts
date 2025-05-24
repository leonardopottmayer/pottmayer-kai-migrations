const fs = require("fs");
const path = require("path");

export function createMigration(name: string) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);

  const migrationName = `${timestamp}-${name}`;

  const upFileName = `${migrationName}.up.sql`;
  const downFileName = `${migrationName}.down.sql`;

  const dir = path.join(process.cwd(), "migrations", migrationName);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, upFileName), `-- ${upFileName}`);
  fs.writeFileSync(path.join(dir, downFileName), `-- ${downFileName}`);

  console.log(`✅ Migration created at ${dir}`);
}
