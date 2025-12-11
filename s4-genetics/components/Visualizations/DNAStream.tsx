import React, { useEffect, useState, useRef } from 'react';
import { MOCK_DNA_BASES } from '../../constants';

const DNAStream: React.FC = () => {
  const [rows, setRows] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate initial rows
    const initialRows = Array.from({ length: 8 }).map(() => generateRow());
    setRows(initialRows);

    const interval = setInterval(() => {
      setRows(prev => [...prev.slice(1), generateRow()]);
    }, 150);

    return () => clearInterval(interval);
  }, []);

  const generateRow = () => {
    return Array.from({ length: 32 })
      .map(() => MOCK_DNA_BASES[Math.floor(Math.random() * MOCK_DNA_BASES.length)])
      .join('');
  };

  return (
    <div className="relative font-mono text-xs overflow-hidden h-64 bg-slate-900 rounded-lg border border-slate-700 p-4 shadow-inner">
      <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-slate-900 to-transparent z-10 pointer-events-none"></div>
      
      <div className="flex flex-col gap-1">
        {rows.map((row, idx) => (
          <div key={idx} className="flex justify-between opacity-90 transition-all duration-300">
            <span className="text-slate-500 mr-4 select-none">
              {(1000 + idx * 32).toString(16).toUpperCase()}
            </span>
            <div className="tracking-widest flex-1 break-all">
              {row.split('').map((base, i) => (
                <span 
                  key={i} 
                  className={`
                    ${base === 'A' ? 'text-green-400' : ''}
                    ${base === 'C' ? 'text-blue-400' : ''}
                    ${base === 'G' ? 'text-yellow-400' : ''}
                    ${base === 'T' ? 'text-red-400' : ''}
                  `}
                >
                  {base}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scanning Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-medical-500 shadow-[0_0_15px_rgba(14,165,233,0.8)] opacity-50 animate-[scan_2s_linear_infinite]" style={{ animationName: 'scanDown' }}></div>
      <style>{`
        @keyframes scanDown {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default DNAStream;