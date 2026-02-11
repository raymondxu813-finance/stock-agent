import { createBrowserRouter } from 'react-router';
import { AgentLobby } from './components/AgentLobby';
import { SynergyNexus } from './components/SynergyNexus';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: AgentLobby,
  },
  {
    path: '/nexus',
    Component: SynergyNexus,
  },
]);
