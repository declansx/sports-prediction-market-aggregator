import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/toaster';
import { Markets } from './pages/Markets';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Coverage } from './pages/Coverage';

const isPublic = import.meta.env.VITE_PUBLIC_MODE === 'true';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Markets />} />
          {!isPublic && <Route path="history" element={<History />} />}
          <Route path="coverage" element={<Coverage />} />
          {!isPublic && <Route path="settings" element={<Settings />} />}
        </Route>
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}
