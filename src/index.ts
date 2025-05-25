#!/usr/bin/env node

import { Command } from "commander";
import { createMigration } from "./commands/create";
import { applyMigrations } from "./commands/apply";
import { rollbackMigrations } from "./commands/rollback";
import { showMigrationStatus } from "./commands/status";

const program = new Command();

program
  .name("kai")
  .description("🧬 Kai: CLI tool for SQL migrations management.")
  .version("1.0.0");

// kai create <name>
program
  .command("create")
  .argument("<name>", "migration name (ex: create-users-table).")
  .description(
    "📦 Creates a new migration (generates folder containing up.sql and down.sql)."
  )
  .action(createMigration);

// kai apply
program
  .command("apply")
  .argument("<env>", "Environment name from config.json.")
  .description("✅ Applies all pending migrations.")
  .action(applyMigrations);

// kai rollback [migration_id]
program
  .command("rollback")
  .argument("<env>", "Environment name.")
  .argument("[migration_id]", "Migration ID to rollback from.")
  .description(
    "↩️ Undo the last applied batch or all batches after a migration_id."
  )
  .action((id) => rollbackMigrations(id));

// kai status
program
  .command("status")
  .argument("<env>", "Environment name.")
  .description("📋 Shows migrations status from last 5 batches.")
  .action(showMigrationStatus);

// ajuda padrão
program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
