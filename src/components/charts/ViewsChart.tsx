import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const data = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000),
  views: Math.floor(Math.random() * 50000) + 10000,
}));

export function ViewsChart() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => format(date, 'MMM d')}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(date) => format(date, 'MMM d, yyyy')}
            formatter={(value: number) => [`${value.toLocaleString()} views`, 'Views']}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="#4F46E5"
            fillOpacity={1}
            fill="url(#viewsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}