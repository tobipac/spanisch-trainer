import { useCallback, useEffect, useRef, useState } from 'react';
import { now } from '../app/clock.ts';
import { shareOrDownload, storageStatus, type StorageStatus } from '../app/platform.ts';
import { availableVoices, onVoicesChanged, speak } from '../audio/speech.ts';
import { chooseVoice, spanishVoices } from '../audio/voices.ts';
import { NEW_PER_DAY_MAX, NEW_PER_DAY_MIN, SPEECH_RATE_MAX, SPEECH_RATE_MIN } from '../config/learning.ts';
import { DERIVED_LICENSE_NOTE, SOURCES } from '../config/sources.ts';
import { backupFileName, exportBackup, importBackup, parseBackup, type BackupFile, type BackupSummary } from '../db/backup.ts';
import { db } from '../db/database.ts';
import { loadSettings, saveSettings } from '../db/repository.ts';
import type { Settings } from '../domain/types.ts';

interface Props {
  onShowOnboarding: () => void;
}

const fmtDate = (d: Date | number) =>
  new Date(d).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtRate = (r: number) => r.toFixed(2).replace('.', ',');

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      <div className="flex flex-col gap-3 rounded-2xl bg-neutral-100 p-4 dark:bg-neutral-900">{children}</div>
    </section>
  );
}

const btn = 'min-h-11 rounded-xl px-4 font-semibold active:scale-95 disabled:opacity-40';
const btnPrimary = `${btn} bg-accent text-white`;
const btnSecondary = `${btn} bg-white text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100`;

/** Einstellungen (SPEC.md Abschnitt 5 und 9). */
export function SettingsScreen({ onShowOnboarding }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [voices, setVoices] = useState(() => spanishVoices(availableVoices()));
  const [info, setInfo] = useState<{ cards: number; words: number; logs: number; storage: StorageStatus } | null>(null);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadInfo = useCallback(async () => {
    const [cards, logs, storage] = await Promise.all([db.cards.toArray(), db.reviewLogs.count(), storageStatus()]);
    setInfo({
      cards: cards.length,
      words: cards.filter((c) => c.direction === 'es-de' && c.introducedAt !== null).length,
      logs,
      storage,
    });
  }, []);

  useEffect(() => {
    void loadSettings(db).then(setSettings);
    void loadInfo();
    return onVoicesChanged(() => setVoices(spanishVoices(availableVoices())));
  }, [loadInfo]);

  const update = (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    void saveSettings(db, next);
  };

  if (!settings) return <div className="h-full" />;

  const activeVoice = chooseVoice(voices, settings.voiceURI);

  // --- Backup: in zwei Schritten, damit „Teilen“ direkt aus einem Tap kommt (iOS-Vorgabe) ---
  const prepareBackup = async () => {
    setBackupMsg(null);
    const t = now();
    const data = await exportBackup(db, t);
    setBackupFile(new File([JSON.stringify(data)], backupFileName(t), { type: 'application/json' }));
  };
  const saveBackup = async () => {
    if (!backupFile) return;
    try {
      const result = await shareOrDownload(backupFile);
      if (result === 'cancelled') return;
      update({ lastBackupAt: now().getTime() });
      setBackupMsg(result === 'shared' ? 'Backup gesichert.' : 'Backup heruntergeladen.');
      setBackupFile(null);
    } catch {
      setBackupMsg('Teilen nicht möglich. Bitte erneut versuchen.');
    }
  };

  const onFileChosen = async (file: File | undefined) => {
    setImportError(null);
    setPendingImport(null);
    if (!file) return;
    try {
      setPendingImport(parseBackup(await file.text()));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };
  const confirmImport = async () => {
    if (!pendingImport) return;
    try {
      await importBackup(db, pendingImport.backup);
      // Das eingespielte Backup existiert ja – als letztes Backup vermerken, falls neuer als der gespeicherte Wert.
      const restored = await loadSettings(db);
      const exportedAt = pendingImport.summary.exportedAt.getTime();
      if ((restored.lastBackupAt ?? 0) < exportedAt) await saveSettings(db, { ...restored, lastBackupAt: exportedAt });
      setPendingImport(null);
      setSettings(await loadSettings(db));
      await loadInfo();
      setBackupMsg('Backup wiederhergestellt.');
    } catch {
      setImportError('Wiederherstellen fehlgeschlagen. Dein bisheriger Stand ist unverändert.');
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-4">
      <header className="pt-2">
        <h1 className="text-3xl font-bold tracking-tight">Einstellungen</h1>
      </header>

      <Section title="Lernen">
        <div className="flex items-center justify-between">
          <span>Neue Wörter pro Tag</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Weniger" className={`${btnSecondary} w-11 px-0`} disabled={settings.newPerDay <= NEW_PER_DAY_MIN} onClick={() => update({ newPerDay: settings.newPerDay - 1 })}>
              −
            </button>
            <span className="w-8 text-center text-xl font-bold tabular-nums">{settings.newPerDay}</span>
            <button type="button" aria-label="Mehr" className={`${btnSecondary} w-11 px-0`} disabled={settings.newPerDay >= NEW_PER_DAY_MAX} onClick={() => update({ newPerDay: settings.newPerDay + 1 })}>
              +
            </button>
          </div>
        </div>
        <p className="text-xs text-neutral-500">
          Auch das Tageslimit für neue Umkehrkarten. Bei vielen fälligen Wiederholungen wird es automatisch gedrosselt.
        </p>
      </Section>

      <Section title="Audio">
        {voices.length === 0 ? (
          <p className="text-sm">
            Keine spanische Stimme gefunden. Die App funktioniert auch ohne Audio. Stimme laden: iOS-Einstellungen →
            Bedienungshilfen → Gesprochene Inhalte → Stimmen → Spanisch (Spanien).
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span>Stimme</span>
            <select
              className="min-h-11 rounded-xl bg-white px-3 dark:bg-neutral-800"
              value={activeVoice?.voiceURI ?? ''}
              onChange={(e) => update({ voiceURI: e.target.value })}
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between">
            <span>Sprechtempo</span>
            <span className="tabular-nums text-neutral-500">{fmtRate(settings.speechRate)}</span>
          </span>
          <input
            type="range"
            min={SPEECH_RATE_MIN}
            max={SPEECH_RATE_MAX}
            step={0.05}
            value={settings.speechRate}
            onChange={(e) => update({ speechRate: Number(e.target.value) })}
            className="h-11 accent-accent"
          />
        </label>
        <button type="button" className={btnSecondary} onClick={() => speak('Hola, ¿qué tal? Vamos a aprender español.', { rate: settings.speechRate, voiceURI: settings.voiceURI })}>
          ▶︎ Probe abspielen
        </button>
        <label className="flex min-h-11 items-center justify-between">
          <span>Audio automatisch abspielen</span>
          <input
            type="checkbox"
            checked={settings.autoPlayAudio}
            onChange={(e) => update({ autoPlayAudio: e.target.checked })}
            className="size-6 accent-accent"
          />
        </label>
      </Section>

      <Section title="Backup">
        <p className="text-sm">
          Letztes Backup: <strong>{settings.lastBackupAt ? fmtDate(settings.lastBackupAt) : 'noch keins'}</strong>
        </p>
        {backupFile ? (
          <button type="button" className={btnPrimary} onClick={() => void saveBackup()}>
            Teilen / In Dateien sichern
          </button>
        ) : (
          <button type="button" className={btnPrimary} onClick={() => void prepareBackup()}>
            Backup erstellen
          </button>
        )}
        {backupFile && <p className="text-xs text-neutral-500">{backupFile.name} ist bereit. Tippe zum Sichern, z. B. „In Dateien sichern“ → iCloud Drive.</p>}
        <button type="button" className={btnSecondary} onClick={() => fileInput.current?.click()}>
          Backup wiederherstellen …
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onFileChosen(e.target.files?.[0])} />
        {pendingImport && (
          <div className="rounded-xl border border-accent/50 bg-white p-3 text-sm dark:bg-neutral-800" role="alertdialog" aria-label="Backup wiederherstellen">
            <p className="font-semibold">Backup vom {fmtDate(pendingImport.summary.exportedAt)}</p>
            <p className="mt-1">
              {pendingImport.summary.wordsIntroduced} Wörter gelernt, {pendingImport.summary.cards} Karten,{' '}
              {pendingImport.summary.reviewLogs} Bewertungen, {pendingImport.summary.days}{' '}
              {pendingImport.summary.days === 1 ? 'Lerntag' : 'Lerntage'}.
            </p>
            <p className="mt-2 font-semibold text-accent">Dein aktueller Stand wird vollständig ersetzt.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" className={`${btnPrimary} flex-1`} onClick={() => void confirmImport()}>
                Ersetzen
              </button>
              <button type="button" className={`${btnSecondary} flex-1`} onClick={() => setPendingImport(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {importError && <p className="text-sm font-semibold text-accent">{importError}</p>}
        {backupMsg && <p className="text-sm">{backupMsg}</p>}
      </Section>

      <Section title="Info">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-neutral-500">App-Version</dt>
          <dd>
            {__APP_VERSION__} ({__BUILD_DATE__})
          </dd>
          <dt className="text-neutral-500">Gelernte Wörter</dt>
          <dd>{info?.words ?? '–'}</dd>
          <dt className="text-neutral-500">Karten</dt>
          <dd>{info?.cards ?? '–'}</dd>
          <dt className="text-neutral-500">Bewertungen</dt>
          <dd>{info?.logs ?? '–'}</dd>
          <dt className="text-neutral-500">Speicher</dt>
          <dd>
            {info?.storage.persisted === true
              ? 'dauerhaft ✓'
              : info?.storage.persisted === false
                ? 'nicht dauerhaft – Backups wichtig'
                : 'unbekannt'}
            {info?.storage.usageBytes !== undefined && ` · ${(info.storage.usageBytes / 1_048_576).toFixed(1).replace('.', ',')} MB`}
          </dd>
        </dl>
        <button type="button" className={btnSecondary} onClick={onShowOnboarding}>
          Einführung erneut ansehen
        </button>
      </Section>

      <Section title="Quellen">
        {SOURCES.map((s) => (
          <div key={s.name} className="text-sm">
            <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold underline">
              {s.name}
            </a>
            <p className="text-neutral-600 dark:text-neutral-400">{s.description}</p>
            <p>
              Lizenz:{' '}
              <a href={s.licenseUrl} target="_blank" rel="noreferrer" className="underline">
                {s.license}
              </a>
            </p>
          </div>
        ))}
        <p className="text-xs text-neutral-500">{DERIVED_LICENSE_NOTE}</p>
      </Section>
    </div>
  );
}
