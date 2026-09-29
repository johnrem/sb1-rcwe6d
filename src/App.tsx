import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Sidebar, type View } from './components/Sidebar';
import { StudioApp } from './studio/StudioApp';
import { DashboardMetricCard } from './components/DashboardMetric';
import { ViewsChart } from './components/charts/ViewsChart';
import { VideoPerformance } from './components/VideoPerformance';
import { AudienceDemographics } from './components/AudienceDemographics';
import { RevenueTracking } from './components/RevenueTracking';
import { CommentAnalysis } from './components/CommentAnalysis';
import type { DashboardMetric } from './types';

const metrics: DashboardMetric[] = [
  {
    label: 'Total Views',
    value: '2.4M',
    change: 12.5,
    trend: 'up',
  },
  {
    label: 'Watch Time (hrs)',
    value: '47.2K',
    change: 8.2,
    trend: 'up',
  },
  {
    label: 'Subscribers',
    value: '89.3K',
    change: -2.4,
    trend: 'down',
  },
  {
    label: 'Revenue',
    value: '$12.4K',
    change: 15.8,
    trend: 'up',
  },
];

const viewFromHash = (): View => (window.location.hash === '#studio' ? 'studio' : 'dashboard');

function App() {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (v: View) => {
    window.location.hash = v;
    setView(v);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="flex flex-col h-screen">
        <Header view={view} onNavigate={navigate} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar view={view} onNavigate={navigate} />
          {view === 'studio' ? (
            <main className="flex-1 min-w-0 overflow-hidden">
              <StudioApp />
            </main>
          ) : (
          <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none">
            <div className="py-6">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
              </div>
              <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                <div className="py-4">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {metrics.map((metric) => (
                      <DashboardMetricCard key={metric.label} metric={metric} />
                    ))}
                  </div>
                  
                  <div className="mt-8 bg-white rounded-lg shadow px-6 py-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Views Over Time</h2>
                    <ViewsChart />
                  </div>

                  <div className="mt-8">
                    <VideoPerformance />
                  </div>

                  <div className="mt-8">
                    <AudienceDemographics />
                  </div>

                  <div className="mt-8">
                    <RevenueTracking />
                  </div>

                  <div className="mt-8 mb-8">
                    <CommentAnalysis />
                  </div>
                </div>
              </div>
            </div>
          </main>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;