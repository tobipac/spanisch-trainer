import { useState } from 'react';
import { HomeScreen } from '../screens/HomeScreen.tsx';
import { LearnScreen } from '../screens/LearnScreen.tsx';

type Screen = 'home' | 'learn';

/** App-Shell: einfache Bildschirm-Umschaltung, Safe-Area-Ränder. */
export function App() {
  const [screen, setScreen] = useState<Screen>('home');

  return (
    <div className="mx-auto flex h-full max-w-lg flex-col px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      {screen === 'home' ? (
        <HomeScreen onStart={() => setScreen('learn')} />
      ) : (
        <LearnScreen onExit={() => setScreen('home')} />
      )}
    </div>
  );
}
