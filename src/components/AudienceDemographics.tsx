import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const ageData = [
  { name: '18-24', value: 30 },
  { name: '25-34', value: 40 },
  { name: '35-44', value: 15 },
  { name: '45-54', value: 10 },
  { name: '55+', value: 5 },
];

const genderData = [
  { name: 'Male', value: 65 },
  { name: 'Female', value: 32 },
  { name: 'Other', value: 3 },
];

const COLORS = ['#4F46E5', '#7C3AED', '#EC4899', '#F59E0B', '#10B981'];

export function AudienceDemographics() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Audience Demographics</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Age Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ageData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {ageData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-4">Gender Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {genderData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}