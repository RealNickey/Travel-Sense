import { ScanProvider } from '@/lib/contexts/ScanContext';
import HazardMap from '@/components/HazardMap';
import ScanControls from '@/components/ScanControls';
import DetectionFeed from '@/components/DetectionFeed';
import SafetyScore from '@/components/SafetyScore';
import ManualReportForm from '@/components/ManualReportForm';
import RealtimeHazards from '@/components/RealtimeHazards';

export default function Home() {
  return (
    <ScanProvider>
      <main className="flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛣️</span>
            <h1 className="text-lg font-bold text-white">Travel-Sense</h1>
          </div>
          <SafetyScore />
        </header>

        {/* Map */}
        <div className="flex-1 relative">
          <HazardMap />
          <RealtimeHazards />
        </div>

        {/* Bottom panel */}
        <div className="bg-gray-900 border-t border-gray-800 px-4 py-4 space-y-3">
          <ScanControls />
          <DetectionFeed />
          <details className="text-sm">
            <summary className="text-gray-400 cursor-pointer hover:text-gray-200 select-none">
              Report a hazard manually
            </summary>
            <div className="mt-2">
              <ManualReportForm />
            </div>
          </details>
        </div>
      </main>
    </ScanProvider>
  );
}
