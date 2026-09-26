import { useState } from 'react';
import { TabBar, type Tab } from '../components/TabBar.tsx';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import { LearnScreen } from '../screens/LearnScreen.tsx';
import { ProgressScreen } from '../screens/ProgressScreen.tsx';

/** App-Shell: Tabs Heute/Fortschritt, Lernen als Vollbild ohne Navigation; Safe-Area-Ränder. */
export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const [learning, setLearning] = useState(false);

  return (
    <div
      className={`mx-auto flex h-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] ${
        // Lernen: voller Abstand zum Home-Indikator (Buttons dürfen nicht mit der Wischgeste kollidieren).
        // Tabs: wie native iOS-Tab-Leisten etwas in die Safe Area hinein.
        learning
          ? 'pb-[max(env(safe-area-inset-bottom),1rem)]'
          : 'pb-[max(calc(env(safe-area-inset-bottom)-14px),0.5rem)]'
      }`}
    >
      {learning ? (
        <LearnScreen onExit={() => setLearning(false)} />
      ) : (
        <>
          <div className="min-h-0 flex-1">
            {tab === 'home' ? <HomeScreen onStart={() => setLearning(true)} /> : <ProgressScreen />}
          </div>
          <TabBar active={tab} onChange={setTab} />
        </>
      )}
    </div>
  );
}
