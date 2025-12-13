import React from 'react';
import { Icon } from './Icon';
import { Translations } from '../types';

interface ToolboxProps {
  t: Translations;
}

export const Toolbox: React.FC<ToolboxProps> = ({ t }) => {
  return (
    <aside className="w-72 bg-panel-dark border-inline-end border-border-dark flex flex-col shrink-0 z-40 shadow-xl border-l border-border-dark">
      <div className="p-4 border-b border-border-dark">
        <h3 className="font-bold text-lg text-white mb-2">{t.components}</h3>
        <div className="relative">
          <span className="absolute top-1/2 rtl:left-3 ltr:right-3 -translate-y-1/2 text-slate-400">
            <Icon name="search" className="text-[18px]" />
          </span>
          <input
            className="w-full bg-[#111418] border border-border-dark rounded-lg py-2 rtl:pl-9 rtl:pr-3 ltr:pr-9 ltr:pl-3 text-sm text-white focus:outline-none focus:border-primary placeholder-slate-500"
            placeholder={t.searchPlaceholder}
            type="text"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Models Category */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>{t.models}</span>
            <Icon name="expand_more" className="text-[16px]" />
          </div>
          
          <ToolItem 
            icon="psychology" 
            title={t.localLoader} 
            desc={t.localLoaderDesc} 
            color="blue" 
          />
          <ToolItem 
            icon="bolt" 
            title={t.nanoEngine} 
            desc={t.nanoEngineDesc} 
            color="yellow" 
          />
        </div>

        {/* IO Category */}
        <div className="space-y-2 pt-2 border-t border-border-dark">
          <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>{t.io}</span>
            <Icon name="expand_more" className="text-[16px]" />
          </div>
          
          <ToolItem 
            icon="input" 
            title={t.promptInput} 
            desc={t.promptInputDesc} 
            color="purple" 
          />
          <ToolItem 
            icon="output" 
            title={t.chatOutput} 
            desc={t.chatOutputDesc} 
            color="green" 
          />
        </div>

        {/* Processing Category */}
        <div className="space-y-2 pt-2 border-t border-border-dark">
          <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase tracking-wider mb-2">
            <span>{t.processing}</span>
            <Icon name="expand_more" className="text-[16px]" />
          </div>
          
          <ToolItem 
            icon="code" 
            title={t.codeParser} 
            desc={t.codeParserDesc} 
            color="rose" 
          />
        </div>
      </div>
    </aside>
  );
};

const ToolItem: React.FC<{ icon: string; title: string; desc: string; color: string }> = ({ icon, title, desc, color }) => {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    purple: "bg-purple-500/20 text-purple-400",
    green: "bg-green-500/20 text-green-400",
    rose: "bg-rose-500/20 text-rose-400",
  };

  return (
    <div className="bg-[#1c2127] p-3 rounded-lg border border-border-dark cursor-move hover:border-primary/50 hover:bg-[#252b33] transition group">
      <div className="flex items-center gap-3">
        <div className={`size-8 rounded flex items-center justify-center ${colorClasses[color]}`}>
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        <Icon name="drag_indicator" className="text-slate-600 rtl:mr-auto ltr:ml-auto group-hover:text-primary" />
      </div>
    </div>
  );
};
