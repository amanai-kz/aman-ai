import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { AnalysisStep } from '../types';
import { jsPDF } from "jspdf";
import { 
  ResponsiveContainer, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  Radar,
  Tooltip,
} from 'recharts';

const STEPS: (AnalysisStep & { icon: React.ElementType })[] = [
  { id: 1, title: 'Collection', description: 'Sample logged', status: 'waiting', icon: Icons.TestTube },
  { id: 2, title: 'Upload', description: 'Secure transfer', status: 'waiting', icon: Icons.UploadCloud },
  { id: 3, title: 'Analysis', description: 'Pattern check', status: 'waiting', icon: Icons.Cpu },
  { id: 4, title: 'Insights', description: 'Risk stratification', status: 'waiting', icon: Icons.TrendingUp },
];

const RADAR_DATA = [
  { subject: 'Metabolic', A: 120, fullMark: 150 },
  { subject: 'Inflammation', A: 98, fullMark: 150 },
  { subject: 'Hormonal', A: 86, fullMark: 150 },
  { subject: 'Nutrition', A: 99, fullMark: 150 },
  { subject: 'Cardio', A: 85, fullMark: 150 },
  { subject: 'Liver', A: 65, fullMark: 150 },
];

const BIOMARKERS = [
  { name: 'Hs-CRP', value: '3.5', unit: 'mg/L', status: 'High', ref: '< 2.0', desc: 'Inflammation Marker' },
  { name: 'HbA1c', value: '5.7', unit: '%', status: 'Warning', ref: '< 5.7', desc: 'Blood Glucose Avg' },
  { name: 'LDL-P', value: '1100', unit: 'nmol/L', status: 'Normal', ref: '< 1300', desc: 'Lipid Particle Count' },
  { name: 'Vitamin D', value: '28', unit: 'ng/mL', status: 'Low', ref: '30-100', desc: 'Immune Support' },
  { name: 'Homocysteine', value: '11', unit: 'umol/L', status: 'Warning', ref: '< 10', desc: 'Cardio Health' },
];

export const DemoSection: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>('idle');
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Simulation effect
  useEffect(() => {
    if (status === 'running') {
      let currentStep = 0;
      const stepInterval = setInterval(() => {
        currentStep++;
        setActiveStep(currentStep);
        setProgress((currentStep / STEPS.length) * 100);

        if (currentStep >= STEPS.length + 1) { // +1 for final processing
          clearInterval(stepInterval);
          setStatus('complete');
        }
      }, 1000);

      return () => clearInterval(stepInterval);
    } else if (status === 'idle') {
      setActiveStep(0);
      setProgress(0);
    }
  }, [status]);

  const startDemo = () => {
    setStatus('running');
  };

  const resetDemo = () => {
    setStatus('idle');
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("AI Blood Analysis Report", 20, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 28);
    
    // Summary Section
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Clinical Summary", 20, 45);
    
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105);
    const summaryLines = doc.splitTextToSize(
      "Patient shows signs of inflammatory stress (Elevated Hs-CRP). Combined with low Vitamin D, this suggests a need for immune system modulation. Metabolic markers are otherwise within normal ranges.", 
      170
    );
    doc.text(summaryLines, 20, 55);
    
    // Confidence stats
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(20, 70, 40, 10, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Confidence: 94%", 25, 76);

    doc.setFillColor(241, 245, 249); 
    doc.roundedRect(65, 70, 40, 10, 2, 2, 'F');
    doc.text("52 Biomarkers", 70, 76);

    // Biomarkers Table Header
    let yPos = 95;
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Biomarker Analysis", 20, yPos);
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("MARKER", 20, yPos);
    doc.text("VALUE", 70, yPos);
    doc.text("REFERENCE", 110, yPos);
    doc.text("STATUS", 160, yPos);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(20, yPos + 3, 190, yPos + 3);
    
    yPos += 15;
    
    // List
    BIOMARKERS.forEach((marker) => {
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(marker.name, 20, yPos);
      
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`${marker.value} ${marker.unit}`, 70, yPos);
      
      doc.text(marker.ref, 110, yPos);
      
      // Status Color
      let statusColor = [16, 185, 129]; // emerald
      if (marker.status === 'High') statusColor = [185, 28, 28]; // red
      if (marker.status === 'Low') statusColor = [245, 158, 11]; // amber
      if (marker.status === 'Warning') statusColor = [234, 88, 12]; // orange
      
      doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.setFont(undefined, 'bold');
      doc.text(marker.status, 160, yPos);
      doc.setFont(undefined, 'normal');
      
      doc.setDrawColor(241, 245, 249);
      doc.line(20, yPos + 5, 190, yPos + 5);
      
      yPos += 15;
    });
    
    doc.save("AmanAI_Blood_Analysis_Report.pdf");
  };

  const getStatusBadgeStyles = (status: string) => {
    switch(status) {
      case 'High': return 'bg-red-50 text-red-700 border-red-100';
      case 'Low': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'Warning': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Controls / Filter Bar styled like the screenshot header inputs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
         <div className="flex items-center gap-3">
           {status === 'running' && (
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                 Processing...
              </div>
           )}
           {status === 'complete' && (
              <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                 Analysis Complete
              </div>
           )}
         </div>

         <div className="flex gap-3 w-full sm:w-auto">
            {status === 'complete' && (
              <>
                <button 
                  onClick={handleDownloadReport}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-medical-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-medical-200 hover:bg-medical-700 hover:scale-105 transition-all duration-200 ring-2 ring-medical-100"
                >
                  <Icons.Download className="w-4 h-4" />
                  Download Report
                </button>
                <button 
                  onClick={resetDemo}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Icons.History className="w-4 h-4" />
                  Reset
                </button>
              </>
            )}
            <button 
              onClick={startDemo}
              disabled={status === 'running' || status === 'complete'}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                 status === 'running' || status === 'complete' 
                 ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                 : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {status === 'running' ? <Icons.Activity className="w-4 h-4 animate-spin" /> : <Icons.Scan className="w-4 h-4" />}
              {status === 'running' ? 'Running Test...' : status === 'complete' ? 'Test Completed' : 'Start New Analysis'}
            </button>
         </div>
      </div>

      {/* VIEW 1: IDLE/RUNNING - Steps as "Stats Cards" */}
      {(status === 'idle' || status === 'running') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4">
          {STEPS.map((step, i) => {
             const Icon = step.icon;
             const isActive = status === 'running' && activeStep === i + 1;
             const isDone = (status === 'running' && activeStep > i + 1) || status === 'complete';
             
             return (
              <div key={i} className={`bg-white p-6 rounded-2xl border transition-all duration-300 ${isActive ? 'border-medical-400 shadow-md ring-1 ring-medical-100' : 'border-slate-200 shadow-sm'}`}>
                <div className="flex items-center gap-3 mb-4 text-slate-500">
                  <div className={`p-1.5 rounded-lg ${isActive ? 'bg-medical-50 text-medical-600' : isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                    {isDone ? <Icons.Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-normal">{step.title}</span>
                </div>
                <div className="text-lg font-medium text-slate-900">{step.description}</div>
                
                {/* Progress bar inside card for running state */}
                {status === 'running' && isActive && (
                   <div className="w-full h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
                      <div className="h-full bg-medical-500 animate-pulse w-2/3 rounded-full"></div>
                   </div>
                )}
              </div>
             )
          })}
        </div>
      )}

      {/* VIEW 2: COMPLETE - Results as "History List Items" */}
      {status === 'complete' && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8">
           
           {/* Summary Card styled like a large stats card */}
           <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-8 items-center">
              <div className="h-64 w-full md:w-64 flex-shrink-0">
                 <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={RADAR_DATA}>
                      <PolarGrid stroke="#f1f5f9" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                      <Radar name="Patient" dataKey="A" stroke="#0ea5e9" strokeWidth={2} fill="#0ea5e9" fillOpacity={0.2} />
                      <Tooltip />
                    </RadarChart>
                 </ResponsiveContainer>
              </div>
              <div className="flex-1">
                 <div className="flex items-center gap-2 mb-2">
                    <Icons.Brain className="w-5 h-5 text-medical-500" />
                    <h3 className="text-lg font-medium text-slate-900">Clinical Summary</h3>
                 </div>
                 <p className="text-slate-500 leading-relaxed mb-4">
                    Patient shows signs of inflammatory stress (Elevated Hs-CRP). 
                    Combined with low Vitamin D, this suggests a need for immune system modulation.
                    Metabolic markers are otherwise within normal ranges.
                 </p>
                 <div className="flex gap-2">
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">Confidence: 94%</span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">52 Biomarkers</span>
                 </div>
              </div>
           </div>

           {/* Biomarker List - Styled exactly like the "History of tests" list items */}
           <div className="grid gap-4">
              {BIOMARKERS.map((marker, i) => (
                <div key={i} className="group bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col md:flex-row gap-6 items-start md:items-center">
                  
                  {/* Icon Box */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform ${marker.status === 'Normal' ? 'bg-slate-50 text-slate-600' : 'bg-red-50 text-red-600'}`}>
                      {marker.status === 'Normal' ? <Icons.CheckCircle2 className="w-6 h-6" /> : <Icons.AlertCircle className="w-6 h-6" />}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-slate-900">{marker.name}</h3>
                      </div>
                      <p className="text-slate-500 text-sm mb-3">{marker.desc}</p>
                      
                      {/* Detailed Stats Chips */}
                      <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                          Value: {marker.value} {marker.unit}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg">
                          Ref: {marker.ref}
                        </span>
                      </div>
                  </div>

                  {/* Right Side Status Pill */}
                  <div className="flex flex-row md:flex-col items-center md:items-end gap-4 md:gap-2 w-full md:w-auto justify-between md:justify-center">
                      <span className="text-xs text-slate-400 font-medium">Just now</span>
                      <span className={`px-3 py-1 border text-xs font-bold rounded-full ${getStatusBadgeStyles(marker.status)}`}>
                        {marker.status}
                      </span>
                  </div>
                </div>
              ))}
           </div>

        </div>
      )}
    </div>
  );
};