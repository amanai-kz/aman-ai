import React, { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const ProteinFold: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    // Initialize data
    const generateData = (offset: number) => {
      const subjects = ['Leu', 'Ala', 'Gly', 'Ser', 'Val', 'Glu', 'Asp', 'Thr'];
      return subjects.map((subject, i) => ({
        subject,
        A: Math.abs(Math.sin((i + offset) * 0.5) * 100) + 20, // Dynamic movement
        fullMark: 150,
      }));
    };

    let time = 0;
    const interval = setInterval(() => {
      time += 0.2;
      setData(generateData(time));
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-64 w-full bg-white rounded-lg border border-slate-200 relative overflow-hidden">
       <div className="absolute top-4 left-4 z-10">
        <h4 className="text-sm font-semibold text-slate-700">Protein Structure Prediction</h4>
        <span className="text-xs text-medical-500 font-medium animate-pulse">Folding Simulation Active...</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
          <Radar
            name="Folding Structure"
            dataKey="A"
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="#38bdf8"
            fillOpacity={0.4}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      {/* Anomaly Highlight Overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur border border-slate-200 p-2 rounded shadow-sm text-xs">
         <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Alpha Helix: Stable</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
            <span className="text-slate-600">Beta Sheet: Analysing...</span>
         </div>
      </div>
    </div>
  );
};

export default ProteinFold;