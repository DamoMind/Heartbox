import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SyncProvider } from '@/contexts/SyncContext';
import { Dashboard, Inventory, ScanPage, History, Settings, ItemForm } from '@/pages';

function App() {
  return (
    <SyncProvider>
      <BrowserRouter>
        {/* Offline Status Banner */}
        <OfflineBanner />

        {/* Main Content */}
        <main className="min-h-screen bg-slate-50 pb-20">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/new" element={<ItemForm />} />
            <Route path="/inventory/:id" element={<ItemForm />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        {/* Bottom Navigation */}
        <Navigation />
      </BrowserRouter>
    </SyncProvider>
  );
}

export default App;
