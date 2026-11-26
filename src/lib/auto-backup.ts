export const BACKUP_INTERVAL_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BACKUP_NAME = /^telos-backup-(\d{4}-\d{2}-\d{2})\.json$/;

/** True when there is no backup, the timestamp is unreadable, or it is at least 7 days old. */
export function backupDue(lastBackupIso: string | null, now: Date): boolean {
  if (lastBackupIso === null) return true;
  const last = new Date(lastBackupIso);
  if (Number.isNaN(last.getTime())) return true;
  return now.getTime() - last.getTime() >= BACKUP_INTERVAL_DAYS * MS_PER_DAY;
}

/** telos-backup-YYYY-MM-DD.json, using the UTC calendar date. */
export function backupFilename(now: Date): string {
  return `telos-backup-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Names sorted newest-first by the date in the name; returns those to delete beyond
 * `keep`; ignores names that do not match the pattern.
 */
export function backupsToPrune(names: string[], keep: number): string[] {
  const dated: { name: string; date: string }[] = [];
  for (const name of names) {
    const match = BACKUP_NAME.exec(name);
    if (!match) continue;
    const [year, month, day] = match[1].split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      continue;
    }
    dated.push({ name, date: match[1] });
  }
  dated.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const limit = Math.max(0, Math.floor(keep));
  return dated.slice(limit).map((entry) => entry.name);
}
