import { useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Workspace } from './pages/Workspace';
import { loadLocalManuscript } from './storage/localManuscript';

type Route = 'home' | 'manuscript';

function routeFromHash(): Route {
  return window.location.hash.replace(/^#/, '') === '/manuscript'
    ? 'manuscript'
    : 'home';
}

export function App() {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const hasDraft = Boolean(loadLocalManuscript());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route === 'manuscript') {
    return <Workspace />;
  }
  return <Home hasDraft={hasDraft} />;
}
