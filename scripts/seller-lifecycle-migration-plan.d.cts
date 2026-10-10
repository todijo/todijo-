export function buildMigrationPlan(
  migrationDirectories: string[],
  trialMigration: string,
  closureMigration: string,
): {
  ordered: string[];
  prePhase3: string[];
  phase3AndLater: string[];
};
