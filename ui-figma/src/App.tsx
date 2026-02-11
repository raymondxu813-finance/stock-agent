import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ChatProvider } from './context/ChatContext';

function App() {
  return (
    <ChatProvider>
      <RouterProvider router={router} />
    </ChatProvider>
  );
}

export default App;