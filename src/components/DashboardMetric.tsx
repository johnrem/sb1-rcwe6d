import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';
import type { DashboardMetric } from '../types';

interface MetricProps {
  metric: DashboardMetric;
}

export function DashboardMetricCard({ metric }: MetricProps) {
  const getTrendIcon = () => {
    switch (metric.trend) {
      case 'up':
        return <ArrowUpIcon className="w-4 h-4 text-green-500" />;
      case 'down':
        return <ArrowDownIcon className="w-4 h-4 text-red-500" />;
      default:
        return <MinusIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-500">{metric.label}</h3>
        {getTrendIcon()}
      </div>
      <div className="flex items-baseline">
        <p className="text-2xl font-semibold text-gray-900">{metric.value}</p>
        <span className={`ml-2 text-sm ${
          metric.trend === 'up' ? 'text-green-500' : 
          metric.trend === 'down' ? 'text-red-500' : 
          'text-gray-500'
        }`}>
          {metric.change > 0 ? '+' : ''}{metric.change}%
        </span>
      </div>
    </div>
  );
}