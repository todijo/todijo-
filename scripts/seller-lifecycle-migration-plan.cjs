function buildMigrationPlan(migrationDirectories, trialMigration, closureMigration) {
  const ordered = [...migrationDirectories].sort();
  if (new Set(ordered).size !== ordered.length) {
    throw new Error("Migration directory names must be unique.");
  }

  const trialIndex = ordered.indexOf(trialMigration);
  const closureIndex = ordered.indexOf(closureMigration);
  if (trialIndex < 0 || closureIndex < 0) {
    throw new Error("Required Phase 3 migration is missing.");
  }
  if (closureIndex !== trialIndex + 1) {
    throw new Error("Phase 3 trial and closure migrations must be adjacent in chronological order.");
  }

  return {
    ordered,
    prePhase3: ordered.slice(0, trialIndex),
    phase3AndLater: ordered.slice(trialIndex),
  };
}

module.exports = { buildMigrationPlan };
