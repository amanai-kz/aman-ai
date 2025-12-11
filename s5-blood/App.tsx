import React from 'react';
import { DemoSection } from './components/DemoSection';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-black selection:text-white relative flex flex-col">
      
      {/* Grid Background Pattern */}
      <div 
        className="fixed inset-0 pointer-events-none z-0" 
        style={{
          backgroundImage: `
            linear-gradient(to right, #f1f5f9 1px, transparent 1px),
            linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 md:px-8 py-8 md:py-12">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Page Title Section matched to screenshot typography */}
          <div className="mb-10">
             <div>
               <h1 className="text-3xl font-semibold text-slate-900 tracking-tight mb-6">AI Blood Analysis</h1>
               
               {/* Service Description moved here */}
               <div className="text-slate-600 leading-relaxed">
                  <h2 className="text-sm font-bold text-black uppercase tracking-widest mb-3">Service Overview</h2>
                  <p className="max-w-4xl text-base md:text-lg">
                    We use AI to analyze over 50 markers in your blood. It finds hidden patterns—like inflammation or hormonal shifts—that standard tests might miss, helping you spot health risks early.
                  </p>
               </div>
             </div>
          </div>

          {/* The Demo Card */}
          <DemoSection />
        
        </div>
      </main>
    </div>
  );
};

export default App;