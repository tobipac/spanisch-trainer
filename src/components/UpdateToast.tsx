import { applyUpdate } from '../app/update.ts';

/** „Update verfügbar – neu laden“ (SPEC.md Abschnitt 10). Wird während einer Session nicht gezeigt. */
export function UpdateToast() {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-neutral-900 px-4 py-2.5 text-white dark:bg-neutral-100 dark:text-neutral-900" role="status">
      <span className="text-sm font-medium">Update verfügbar</span>
      <button type="button" onClick={applyUpdate} className="min-h-11 rounded-xl bg-accent px-4 text-sm font-semibold text-white active:scale-95">
        Neu laden
      </button>
    </div>
  );
}
