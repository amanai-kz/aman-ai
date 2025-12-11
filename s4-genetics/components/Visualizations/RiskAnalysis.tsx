import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RiskAnalysis: React.FC = () => {
  const [data, setData] = useState<{name: string, value: number}[]>([]);
  const [riskScore, setRiskScore] = useState(0);

  useEffect(() => {
    // Populate historical trend
    const initialData = Array.from({ length: 20 }).map((_, i) => ({
      name: i.toString(),
      value: 10 + Math.random() * 10
    }));
    setData(initialData);

    const interval = setInterval(() => {
      setRiskScore(prev => {
        if (prev >= 78) return 78; // Target score
        return prev + 2;
      });

      setData(prev => {
        const lastVal = prev[prev.length - 1].value;
        const newVal = Math.min(100, Math.max(0, lastVal + (Math.random() - 0.4) * 15));
        return [...prev.slice(1), { name: '', value: newVal }];
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-64 flex gap-4">
      {/* Risk Gauge */}
      <div className="w-1/3 bg-slate-50 rounded-lg border border-slate-200 flex flex-col items-center justify-center p-4">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-200"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className={`${riskScore > 50 ? 'text-amber-500' : 'text-emerald-500'} transition-all duration-300`}
              strokeDasharray={`${riskScore}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-slate-800 leading-none mb-1">{riskScore}%</span>
            <div className="flex flex-col items-center leading-none">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Risk</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Probability</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4 flex flex-col relative overflow-hidden">
        <div className="text-sm font-semibold text-slate-700 pb-2 z-10 relative bg-white">Biomarker Volatility Index</div>
        <div className="flex-1 w-full min-h-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" hide />
              <YAxis hide domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#ef4444" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default RiskAnalysis;