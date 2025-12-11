import React from 'react';
import { AnalysisStep } from '../types';
import { STEP_ICONS } from '../constants';
import { LucideIcon } from 'lucide-react';

interface StepCardProps {
  stepId: AnalysisStep;
  title: string;
  description: string;
  isActive: boolean;
  isCompleted: boolean;
}

const StepCard: React.FC<StepCardProps> = ({ stepId, title, description, isActive, isCompleted }) => {
  const Icon = STEP_ICONS[stepId] as LucideIcon;

  return (
    <div 
      className={`
        relative overflow-hidden rounded-2xl p-6 transition-all duration-300 border flex flex-col justify-between h-full
        ${isActive 
          ? 'bg-white border-medical-200 shadow-lg ring-1 ring-medical-50 transform scale-[1.02] z-10' 
          : 'bg-white border-slate-100 shadow-sm hover:border-slate-300 hover:shadow-md'
        }
      `}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`
          p-2.5 rounded-xl
          ${isActive || isCompleted ? 'bg-medical-50 text-medical-600' : 'bg-slate-50 text-slate-400'}
        `}>
          {Icon ? <Icon size={20} /> : null}
        </div>
        
        {isCompleted && (
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-medium border border-emerald-100">
            Completed
          </span>
        )}
        {isActive && (
           <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-medium border border-blue-100 animate-pulse">
            Processing
          </span>
        )}
      </div>

      <div>
        <h3 className={`font-medium text-base mb-2 ${isActive ? 'text-slate-900' : 'text-slate-700'}`}>
          {title}
        </h3>
        
        <p className="text-xs text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>

      {/* Progress Line for Active Card */}
      {isActive && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-medical-50">
           <div className="h-full bg-medical-500 animate-[width_3s_linear_infinite]" style={{ width: '100%' }}></div>
        </div>
      )}
    </div>
  );
};

export default StepCard;