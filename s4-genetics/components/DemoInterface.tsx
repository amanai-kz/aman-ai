import React, { useState, useEffect, useRef } from 'react';
import { AnalysisStep, StepConfig, LogEntry } from '../types';
import { STEPS, SAMPLE_METRICS } from '../constants';
import { Play, CheckCircle2, AlertCircle, RefreshCw, Activity, Terminal, Clock, FileText, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

import DNAStream from './Visualizations/DNAStream';
import ProteinFold from './Visualizations/ProteinFold';
import RiskAnalysis from './Visualizations/RiskAnalysis';

interface DemoInterfaceProps {
  currentStep: AnalysisStep;
  progress: number;
  isRunning: boolean;
  onStart: () => void;
  onReset: () => void;
}

const DemoInterface: React.FC<DemoInterfaceProps> = ({ 
  currentStep, 
  progress, 
  isRunning, 
  onStart, 
  onReset 
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Log generation logic
  useEffect(() => {
    if (!isRunning && currentStep === AnalysisStep.IDLE) {
      setLogs([]);
      return;
    }

    const messages: Record<string, string[]> = {
      [AnalysisStep.COLLECTION]: [
        "Ingesting genomic sequences",
        "Validating checksums",
        "Encrypted data handshake"
      ],
      [AnalysisStep.EXTRACT]: [
        "Normalizing read depth",
        "Identifying SNPs (Exon 12)",
        "Standardizing biomarkers"
      ],
      [AnalysisStep.FOLD]: [
        "Simulating AlphaFold structure",
        "Calculating stability",
        "Mapping tertiary structure"
      ],
      [AnalysisStep.ANALYZE]: [
        "Running ensemble models",
        "Calculating risk score",
        "ClinVar DB check"
      ],
      [AnalysisStep.REVIEW]: [
        "Generating clinical summary",
        "Creating DICOM overlays",
        "Finalizing report"
      ]
    };

    if (messages[currentStep]) {
        const interval = setInterval(() => {
            const possibleLogs = messages[currentStep];
            const randomLog = possibleLogs[Math.floor(Math.random() * possibleLogs.length)];
            const newLog: LogEntry = {
                id: Math.random().toString(36).substr(2, 9),
                timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                message: randomLog,
                type: 'info'
            };
            setLogs(prev => [...prev.slice(-4), newLog]);
        }, 1200);
        return () => clearInterval(interval);
    }
  }, [currentStep, isRunning]);

  const generateReport = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(14, 165, 233); // medical-500
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("GenFlow AI Analysis Report", 20, 25);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 35);
    doc.text("Ref: #GF-924-XQ", pageWidth - 50, 35);

    // Patient Info
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text("Patient Analysis Summary", 20, 60);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Sample ID: 8842-Alpha", 20, 70);
    doc.text("Sequencing Depth: 30x", 20, 76);
    doc.text("Panel: Cardio-Genetic V4", 20, 82);

    // Risk Score
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 90, pageWidth - 20, 90);
    
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Risk Probability Score", 20, 105);
    
    doc.setFontSize(30);
    doc.setTextColor(234, 88, 12); // Orange/Amber
    doc.text("78%", 20, 120);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Category: HIGH RISK", 20, 128);
    
    // Key Findings
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Key Findings", 80, 105);
    
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const findings = [
      "• Variant detected in MYH7 gene (Exon 12)",
      "• Protein structure instability observed in beta-sheet region",
      "• Elevated CRP levels (4.8 mg/L) indicating inflammation",
      "• LDL-C above threshold (145 mg/dL)"
    ];
    let yPos = 115;
    findings.forEach(finding => {
      doc.text(finding, 80, yPos);
      yPos += 8;
    });

    // Biomarkers Table
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 150, pageWidth - 20, 150);
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Biomarker Panel", 20, 165);

    // Table Header
    doc.setFontSize(10);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(20, 175, pageWidth - 40, 10, 'F');
    
    doc.setTextColor(71, 85, 105); // slate-600
    doc.setFont(undefined, 'bold');
    doc.text("Metric", 25, 181);
    doc.text("Value", 80, 181);
    doc.text("Status", 130, 181);
    doc.setFont(undefined, 'normal');

    // Table Rows
    let tableY = 195;
    
    SAMPLE_METRICS.forEach((metric) => {
       doc.setTextColor(51, 65, 85); // slate-700
       doc.text(metric.label, 25, tableY);
       
       doc.text(`${metric.value} ${metric.unit}`, 80, tableY);
       
       // Color coding for status
       if (metric.status === 'warning') {
          doc.setTextColor(234, 88, 12); // orange-600
       } else if (metric.status === 'normal') {
          doc.setTextColor(22, 163, 74); // green-600
       }
       doc.text(metric.status.toUpperCase(), 130, tableY);
       
       // Reset color
       doc.setTextColor(51, 65, 85);
       
       // Add subtle separator line
       doc.setDrawColor(241, 245, 249);
       doc.line(20, tableY + 4, pageWidth - 20, tableY + 4);
       
       tableY += 12;
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text("This report is generated by GenFlow AI for demonstration purposes only. Not for clinical use.", pageWidth / 2, 280, { align: "center" });

    doc.save("GenFlow_Analysis_Report_924.pdf");
  };

  const renderVisualizer = () => {
    switch (currentStep) {
      case AnalysisStep.COLLECTION:
      case AnalysisStep.EXTRACT:
        return <DNAStream />;
      case AnalysisStep.FOLD:
        return <ProteinFold />;
      case AnalysisStep.ANALYZE:
      case AnalysisStep.REVIEW:
      case AnalysisStep.COMPLETE:
        return <RiskAnalysis />;
      default:
        return (
          <div className="h-64 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
            <Activity size={40} className="mb-3 opacity-30" />
            <p className="text-sm font-medium text-slate-500">Analysis Pending Start</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Control Header - Styled like a filter bar */}
      <div className="flex justify-between items-center mb-6">
         <div className="flex items-center gap-4">
            <h2 className="text-2xl font-medium text-slate-900">Live Analysis</h2>
            {isRunning && (
               <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-100 flex items-center gap-2">
                 <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                 Processing Batch #924
               </span>
            )}
         </div>
         
         <div>
            {currentStep === AnalysisStep.COMPLETE ? (
              <button 
                onClick={onReset}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm"
              >
                <RefreshCw size={16} />
                <span>Start New Analysis</span>
              </button>
            ) : (
              <button 
                onClick={onStart}
                disabled={isRunning}
                className={`
                  flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium shadow-sm transition-all border
                  ${isRunning 
                    ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                    : 'bg-white text-slate-800 border-slate-200 hover:border-medical-300 hover:text-medical-600 hover:shadow-md'
                  }
                `}
              >
                <Play size={16} fill={isRunning ? "currentColor" : "currentColor"} className={isRunning ? "" : "text-medical-500"} />
                <span>Start Demo Analysis</span>
              </button>
            )}
         </div>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Visualizer Area */}
        <div className="lg:col-span-2 space-y-6">
           <div className="bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-500">
                        {currentStep === AnalysisStep.IDLE ? <Activity size={18}/> : <Activity size={18} className="text-medical-500" />}
                    </div>
                    <div>
                        <h3 className="font-medium text-slate-900">
                            {currentStep === AnalysisStep.IDLE ? 'Ready' : STEPS.find(s => s.id === currentStep)?.title || 'Complete'}
                        </h3>
                        <p className="text-xs text-slate-500">Real-time Visualization</p>
                    </div>
                 </div>
                 <div className="text-right">
                    <span className="text-xs font-mono text-slate-400">FPS: 60</span>
                 </div>
             </div>
             <div className="p-4">
                 {renderVisualizer()}
             </div>
           </div>

           {/* Metrics Grid - Styled like "History of tests" top cards */}
           <div className="grid grid-cols-4 gap-4">
              {SAMPLE_METRICS.map((metric, idx) => (
                <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between h-24">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-medium text-slate-500">{metric.label}</span>
                    <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-slate-800 tracking-tight">
                      {isRunning ? (Math.random() > 0.5 ? metric.value : '...') : metric.value}
                    </span>
                    <span className="text-xs text-slate-400 ml-1">{metric.unit}</span>
                  </div>
                </div>
              ))}
           </div>
        </div>

        {/* Sidebar: Logs - Styled like the "History" list items */}
        <div className="lg:col-span-1 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4 px-1">
             <h3 className="font-medium text-slate-900">System Activity</h3>
             <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">Live Feed</span>
          </div>
          
          <div className="flex-1 space-y-3 relative">
             {logs.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <Clock size={32} strokeWidth={1.5} className="mb-2" />
                    <p className="text-sm">Waiting for sequence start...</p>
                </div>
             )}
             
             {logs.map((log) => (
               <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-slide-up flex items-center justify-between group hover:border-slate-300 transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600 transition-colors">
                        <FileText size={16} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{log.message}</span>
                        <span className="text-[10px] text-slate-400">Process ID: {log.id}</span>
                    </div>
                 </div>
                 
                 <div className="flex flex-col items-end gap-1">
                     <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                     <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.type === 'error' 
                        ? 'bg-red-50 text-red-600' 
                        : 'bg-emerald-50 text-emerald-600'
                     }`}>
                        {log.type === 'error' ? 'Failed' : 'Success'}
                     </span>
                 </div>
               </div>
             ))}
             <div ref={logsEndRef} />
          </div>

          {currentStep === AnalysisStep.COMPLETE && (
            <div className="mt-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                    <CheckCircle2 size={18} />
                 </div>
                 <div>
                    <p className="text-sm font-medium text-slate-900">Analysis Complete</p>
                    <p className="text-xs text-slate-500">Report generated successfully</p>
                 </div>
              </div>
              <button 
                onClick={generateReport}
                className="whitespace-nowrap flex items-center gap-2 text-xs bg-medical-600 text-white px-4 py-2 rounded-full font-medium shadow-lg shadow-medical-200 hover:bg-medical-700 hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                 <Download size={14} />
                 <span>Download Report</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 z-50">
        <div 
          className="h-full bg-medical-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(14,165,233,0.5)]"
          style={{ width: `${progress}%`, opacity: isRunning ? 1 : 0 }}
        ></div>
      </div>
    </div>
  );
};

export default DemoInterface;