import React, { useState, useEffect, useCallback } from 'react';
import { AnalysisStep } from './types';
import { STEPS } from './constants';
import StepCard from './components/StepCard';
import DemoInterface from './components/DemoInterface';
import { Dna, ArrowRight, FileSearch } from './components/Icons'; // Added FileSearch or similar icon if needed, though using lucide

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AnalysisStep>(AnalysisStep.IDLE);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // Core Simulation Engine
  const runSimulation = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      setCurrentStep(step.id);
      
      // Calculate progress chunks based on steps
      const startProgress = (i / STEPS.length) * 100;
      const endProgress = ((i + 1) / STEPS.length) * 100;
      
      const startTime = Date.now();
      
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const percentageComplete = Math.min(elapsed / step.duration, 1);
          
          setProgress(startProgress + (endProgress - startProgress) * percentageComplete);
          
          if (elapsed >= step.duration) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      });
    }

    setCurrentStep(AnalysisStep.COMPLETE);
    setProgress(100);
    setIsRunning(false);
  }, []);

  const handleReset = () => {
    setCurrentStep(AnalysisStep.IDLE);
    setProgress(0);
    setIsRunning(false);
  };

  return (
    <div className="min-h-screen bg-grid-pattern text-slate-900 pb-20 font-sans">
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-6">
        
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-medium text-slate-900 mb-4">Genetic + Blood ML Analysis</h1>
          
          <div className="max-w-3xl">
            <h3 className="text-sm font-semibold text-slate-900 mb-2 uppercase tracking-wide">About This Service</h3>
            <p className="text-slate-600 leading-relaxed text-sm">
              This tool combines DNA sequencing and blood analysis using AI to detect genetic risks. It identifies variants, analyzes protein structures, and calculates risk scores to help doctors provide personalized patient care.
            </p>
          </div>
        </div>

        {/* How It Works (Top Row) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-slate-800">Pipeline Workflow</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {STEPS.map((step, index) => {
               const isActive = currentStep === step.id;
               const stepIndex = STEPS.findIndex(s => s.id === step.id);
               const currentIndex = STEPS.findIndex(s => s.id === currentStep);
               const isCompleted = currentStep === AnalysisStep.COMPLETE || (currentIndex > -1 && currentIndex > stepIndex);

               return (
                <StepCard
                  key={step.id}
                  stepId={step.id}
                  title={step.title}
                  description={step.description}
                  isActive={isActive}
                  isCompleted={isCompleted}
                />
               );
            })}
          </div>
        </div>

        {/* Interactive Demo Area */}
        <div className="mb-12">
          <DemoInterface 
            currentStep={currentStep}
            progress={progress}
            isRunning={isRunning}
            onStart={runSimulation}
            onReset={handleReset}
          />
        </div>

      </main>
    </div>
  );
};

export default App;