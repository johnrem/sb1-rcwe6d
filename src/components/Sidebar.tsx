import {
  LayoutDashboard,
  Layers,
  TrendingUp, 
  Users, 
  DollarSign,
  MessageSquare,
  Settings,
  HelpCircle
} from 'lucide-react';

export type View = 'dashboard' | 'studio';

const navigation: { name: string; icon: typeof LayoutDashboard; view?: View }[] = [
  { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard' },
  { name: 'Content Studio', icon: Layers, view: 'studio' },
  { name: 'Performance', icon: TrendingUp },
  { name: 'Audience', icon: Users },
  { name: 'Revenue', icon: DollarSign },
  { name: 'Comments', icon: MessageSquare },
];

const secondaryNavigation = [
  { name: 'Settings', icon: Settings },
  { name: 'Help', icon: HelpCircle },
];

export function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <div className="hidden lg:flex lg:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col flex-grow bg-gray-800 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <img
              className="h-8 w-auto"
              src="https://www.youtube.com/s/desktop/28b67e7f/img/favicon_144x144.png"
              alt="YouTube Analytics"
            />
            <span className="ml-3 text-xl font-bold text-white">Analytics Pro</span>
          </div>
          <nav className="mt-8 flex-1 flex flex-col" aria-label="Sidebar">
            <div className="px-2 space-y-1">
              {navigation.map((item) => {
                const current = item.view === view;
                return (
                <a
                  key={item.name}
                  href={item.view ? `#${item.view}` : '#'}
                  onClick={(e) => {
                    e.preventDefault();
                    if (item.view) onNavigate(item.view);
                  }}
                  className={`
                    group flex items-center px-2 py-2 text-sm font-medium rounded-md
                    ${current
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 flex-shrink-0 h-6 w-6
                      ${current
                        ? 'text-white'
                        : 'text-gray-400 group-hover:text-gray-300'
                      }
                    `}
                  />
                  {item.name}
                </a>
                );
              })}
            </div>
            <div className="mt-auto pt-4 px-2 space-y-1">
              {secondaryNavigation.map((item) => (
                <a
                  key={item.name}
                  href="#"
                  className="group flex items-center px-2 py-2 text-sm font-medium rounded-md text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  <item.icon className="mr-3 flex-shrink-0 h-6 w-6 text-gray-400 group-hover:text-gray-300" />
                  {item.name}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}