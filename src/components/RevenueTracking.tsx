import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays } from 'date-fns';

const data = Array.from({ length: 7 }, (_, i) => ({
  date: subDays(new Date(), 6 - i),
  adsense: Math.floor(Math.random() * 500) + 100,
  sponsorships: Math.floor(Math.random() * 1000) + 200,
  merchandise: Math.floor(Math.random() * 300) + 50,
}));

export function RevenueTracking() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h2>
      </div>
      <div className="p-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(date, 'MMM d')}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(value) => `$${value}`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                labelFormatter={(date) => format(date, 'MMM d, yyyy')}
                formatter={(value: number) => [`$${value}`, '']}
              />
              <Bar dataKey="adsense" name="AdSense" stackId="a" fill="#4F46E5" />
              <Bar dataKey="sponsorships" name="Sponsorships" stackId="a" fill="#7C3AED" />
              <Bar dataKey="merchandise" name="Merchandise" stackId="a" fill="#EC4899" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}