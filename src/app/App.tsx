import { useEffect, useState } from 'react';
import { InstallHint } from '../components/InstallHint.tsx';
import { TabBar, type Tab } from '../components/TabBar.tsx';
import { UpdateToast } from '../components/UpdateToast.tsx';
import { db } from '../db/database.ts';
import { loadSettings, saveSettings } from '../db/repository.ts';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import { LearnScreen } from '../screens/LearnScreen.tsx';
import { OnboardingScreen } from '../screens/OnboardingScreen.tsx';
import { PracticeScreen } from '../screens/PracticeScreen.tsx';
import { ProgressScreen } from '../screens/ProgressScreen.tsx';
import { SettingsScreen } from '../screens/SettingsScreen.tsx';
import { isStandalone } from './platform.ts';
import { useUpdateAvailable } from './update.ts';

type Mode = 'loading' | 'onboarding' | 'tabs' | 'learning' | 'practice';

/** App-Shell: Onboarding beim ersten Start, Tabs, Lernen als Vollbild; Safe-Area-Ränder. */
export function App() {
  const [mode, setMode] = useState<Mode>('loading');
  const [tab, setTab] = useState<Tab>('home');
  const updateAvailable = useUpdateAvailable();
  const standalone = isStandalone();

  useEffect(() => {
    void loadSettings(db).then((s) => setMode(s.onboardingDone ? 'tabs' : 'onboarding'));
  }, []);

  const finishOnboarding = async () => {
    await saveSettings(db, { ...(await loadSettings(db)), onboardingDone: true });
    setMode('tabs');
  };

  return (
    <div
      className={`mx-auto flex h-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] ${
        // Lernen: voller Abstand zum Home-Indikator (Buttons dürfen nicht mit der Wischgeste kollidieren).
        // Tabs: wie native iOS-Tab-Leisten etwas in die Safe Area hinein.
        mode === 'tabs'
          ? 'pb-[max(calc(env(safe-area-inset-bottom)-14px),0.5rem)]'
          : 'pb-[max(env(safe-area-inset-bottom),1rem)]'
      }`}
    >
      {mode === 'onboarding' && (
        <main className="min-h-0 flex-1">
          <OnboardingScreen onDone={() => void finishOnboarding()} />
        </main>
      )}
      {mode === 'learning' && (
        <main className="min-h-0 flex-1">
          <LearnScreen onExit={() => setMode('tabs')} />
        </main>
      )}
      {mode === 'practice' && (
        <main className="min-h-0 flex-1">
          <PracticeScreen onExit={() => setMode('tabs')} />
        </main>
      )}
      {mode === 'tabs' && (
        <>
          {!standalone && <InstallHint />}
          {/* Kein Update-Hinweis während einer Session – erst zurück in den Tabs. */}
          {updateAvailable && <UpdateToast />}
          <main className="min-h-0 flex-1">
            {tab === 'home' && <HomeScreen onStart={() => setMode('learning')} onPractice={() => setMode('practice')} />}
            {tab === 'progress' && <ProgressScreen />}
            {tab === 'settings' && <SettingsScreen onShowOnboarding={() => setMode('onboarding')} />}
          </main>
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
