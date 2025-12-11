import React from 'react';
import { Icons } from './Icons';

export const HistoryDashboard: React.FC = () => {
  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">History of tests</h1>
          <p className="text-slate-500 mt-2 text-lg">All your diagnostics and results</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-slate-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all hover:bg-slate-50 placeholder:text-slate-400"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Icons.Filter className="w-4 h-4" />
            Filter
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total number of tests', value: '3', icon: Icons.Activity },
          { label: 'Questionnaires', value: '1', icon: Icons.ClipboardList },
          { label: 'Photos', value: '1', icon: Icons.Brain },
          { label: 'IoT sessions', value: '1', icon: Icons.Clock }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4 text-slate-500">
              <stat.icon className="w-5 h-5 opacity-70" />
              <span className="text-sm font-normal">{stat.label}</span>
            </div>
            <div className="text-3xl font-medium text-slate-900">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {/* Item 1 */}
        <div className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
           <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:scale-110 transition-transform">
              <Icons.ClipboardList className="w-6 h-6" />
           </div>
           <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                 <h3 className="font-medium text-slate-900">PSS-10 questionnaire</h3>
              </div>
              <p className="text-slate-500 text-sm mb-3">Stress level assessment</p>
              <div className="flex flex-wrap gap-2">
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Score : 18</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Level : Average</span>
              </div>
           </div>
           <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between md:justify-center">
              <span className="text-xs text-slate-400 font-medium">2 days ago</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold rounded-full">Completed</span>
           </div>
        </div>

        {/* Item 2 */}
        <div className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
           <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:scale-110 transition-transform">
              <Icons.Activity className="w-6 h-6" />
           </div>
           <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-900 mb-1">IoT Monitoring</h3>
              <p className="text-slate-500 text-sm mb-3">Session 15 minutes</p>
              <div className="flex flex-wrap gap-2">
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">HRV : 45 ms</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Stress : 32%</span>
              </div>
           </div>
           <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between md:justify-center">
              <span className="text-xs text-slate-400 font-medium">5 days ago</span>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold rounded-full">Completed</span>
           </div>
        </div>

        {/* Item 3 */}
        <div className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
           <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 text-slate-600 group-hover:scale-110 transition-transform">
              <Icons.Scan className="w-6 h-6" />
           </div>
           <div className="flex-1 min-w-0">
              <h3 className="font-medium text-slate-900 mb-1">MRI of the brain</h3>
              <p className="text-slate-500 text-sm mb-3">AI photo analysis</p>
              <div className="flex flex-wrap gap-2">
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Findings : 0</span>
                 <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Confidence : 94%</span>
              </div>
           </div>
           <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between md:justify-center">
              <span className="text-xs text-slate-400 font-medium">November 30</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold rounded-full">Doctor checked</span>
           </div>
        </div>
      </div>
    </div>
  );
};