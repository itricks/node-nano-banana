import React from 'react';
import { Translations } from '../types';

interface PropertiesPanelProps {
  t: Translations;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ t }) => {
  return (
    <aside className="w-80 bg-panel-dark border-inline-start border-border-dark flex flex-col shrink-0 z-40 overflow-y-auto border-r border-border-dark">
      <div className="p-4 border-b border-border-dark flex justify-between items-center">
        <h3 className="font-bold text-lg text-white">{t.nodeProperties}</h3>
        <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary border border-primary/30">
          {t.nanoEngine}
        </span>
      </div>
      
      <div className="p-5 space-y-6">
        {/* System Prompt */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300 block">{t.systemPrompt}</label>
          <textarea 
            className="w-full bg-[#111418] border border-border-dark rounded-lg p-3 text-sm text-slate-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-24 resize-none leading-relaxed" 
            placeholder="You are a helpful assistant..."
          />
          <p className="text-[10px] text-slate-500">{t.systemPromptDesc}</p>
        </div>
        
        <div className="h-px bg-border-dark w-full"></div>
        
        {/* Sliders */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">{t.temperature}</label>
              <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">0.7</span>
            </div>
            <input 
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary" 
              type="range" min="0" max="1" step="0.1" defaultValue="0.7" 
            />
            <div className="flex justify-between mt-1 text-[10px] text-slate-500">
              <span>{t.precise}</span>
              <span>{t.creative}</span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">{t.maxTokens}</label>
              <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">2048</span>
            </div>
            <input 
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary" 
              type="range" min="256" max="8192" step="256" defaultValue="2048" 
            />
          </div>
        </div>
        
        <div className="h-px bg-border-dark w-full"></div>
        
        {/* Toggles */}
        <div className="space-y-3">
          <ToggleItem label={t.streamResponse} desc={t.streamResponseDesc} checked={true} />
          <ToggleItem label={t.jsonMode} desc={t.jsonModeDesc} checked={false} />
        </div>
      </div>
    </aside>
  );
};

const ToggleItem: React.FC<{ label: string; desc: string; checked: boolean }> = ({ label, desc, checked }) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-slate-300">{label}</span>
        <span className="text-[10px] text-slate-500">{desc}</span>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" defaultChecked={checked} />
        <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] rtl:after:right-[2px] rtl:after:left-auto after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
      </label>
    </div>
  );
};
