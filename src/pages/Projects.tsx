import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Calendar, CheckCircle2, Clock, Plus, Search, Activity, ChevronRight, AlertTriangle } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { Project } from '../types';

export function Projects() {
  const { projects, contributors, authConfig } = useAppStore();
  const [search, setSearch] = useState('');
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjectIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const filtered = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const calculateProgress = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) return { real: 0, virtual: 0 };
    const totalWeight = project.tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    if (totalWeight === 0) return { real: 0, virtual: 0 };

    let doneWeight = 0;
    let virtualWeight = 0;

    project.tasks.forEach(t => {
      const w = t.weight || 1;
      if (t.status === 'Done') {
        doneWeight += w;
      } else if (t.actions && t.actions.length > 0) {
        const doneActions = t.actions.filter(a => a.status === 'Done').length;
        virtualWeight += w * (doneActions / t.actions.length);
      }
    });

    return {
      real: (doneWeight / totalWeight) * 100,
      virtual: (virtualWeight / totalWeight) * 100,
    };
  };

  const getProjectHealth = (project: Project) => {
    if (project.status === 'Done')
      return { label: 'Completed', color: 'text-slate-500', bg: 'bg-slate-500', border: 'border-slate-500' };

    const blocked = (project.tasks || []).filter(t => t.status === 'Blocked').length;
    const today = new Date();
    const deadline = new Date(project.deadline);
    const isOverdue = today > deadline;
    const sevenDays = 604_800_000; // ms

    if (isOverdue || blocked > 2)
      return { label: 'Off Track', color: 'text-red-500', bg: 'bg-red-500', border: 'border-red-500', highlight: 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' };
    if (blocked > 0 || (deadline.getTime() - today.getTime()) < sevenDays)
      return { label: 'At Risk', color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', highlight: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]' };
    
    return { label: 'On Track', color: 'text-emerald-500', bg: 'bg-emerald-500', border: 'border-emerald-500', highlight: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]' };
  };

  const getDaysRemaining = (deadline: string) => {
    const end = new Date(deadline).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8 max-w-7xl mx-auto h-full flex flex-col pb-20"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border pb-8">
        <div>
          <h1 className="text-6xl font-black tracking-tighter uppercase leading-none">Projects Hub</h1>
          <p className="text-sm text-white/50 uppercase tracking-widest font-bold mt-4 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            AI Operations & Delivery Control
          </p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input 
              placeholder="Search projects..." 
              className="pl-9 bg-[#111] border-border focus-visible:ring-primary h-10 w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {authConfig.isAuthenticated && (
            <Button className="shrink-0 h-10 px-6 uppercase tracking-widest text-xs font-bold font-mono">
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Global Status Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Active', value: projects.length.toString(), color: 'text-white' },
          { label: 'Completed', value: projects.filter(p => p.status === 'Done').length.toString(), color: 'text-emerald-500' },
          { label: 'At Risk / Delayed', value: projects.filter(p => getDaysRemaining(p.deadline) < 14 && p.status !== 'Done').length.toString(), color: 'text-red-500' },
          { label: 'Next Deployment', value: projects.length > 0 ? getDaysRemaining(projects.sort((a,b)=>new Date(a.deadline).getTime()-new Date(b.deadline).getTime())[0].deadline) + ' Days' : 'N/A', color: 'text-primary' },
        ].map((stat, i) => (
          <div key={i} className="p-4 bg-[#0C0C0D] border border-border flex flex-col justify-center">
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-2">{stat.label}</p>
            <p className={`text-3xl font-black ${stat.color} leading-none tracking-tighter`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {filtered.map((project, i) => {
          const progress = calculateProgress(project);
          const daysLeft = getDaysRemaining(project.deadline);
          const health = getProjectHealth(project);

          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative group"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${health.bg}`}></div>
              
              <div className="bg-[#111] border border-border p-6 md:p-8 ml-1 transition-all hover:bg-[#151515]">
                
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <h3 className="text-3xl font-black uppercase tracking-tighter">{project.name}</h3>
                       <Badge variant="outline" className={`uppercase tracking-widest text-[9px] ${health.color} ${health.border}`}>{health.label}</Badge>
                       {project.isImportant && <Badge variant="secondary" className="uppercase tracking-widest text-[9px]">Important</Badge>}
                    </div>
                    <p className="text-sm text-white/60 max-w-2xl leading-relaxed">{project.description}</p>
                  </div>
                  
                  <div className="flex gap-8 items-start shrink-0">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Status</p>
                      <p className="text-sm font-mono text-white tracking-widest uppercase">{project.status}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Owner</p>
                      <div className="flex items-center gap-2">
                         <div className="w-6 h-6 bg-white/10 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                           {project.owner ? project.owner.split(' ').map((n: string)=>n[0]).join('').substring(0,2) : '?'}
                         </div>
                         <p className="text-sm font-bold uppercase">{project.owner || 'Unassigned'}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className={`transition-transform ${expandedProjectIds.includes(project.id) ? 'rotate-90' : 'group-hover:translate-x-1'}`} onClick={(e) => toggleExpand(project.id, e)}>
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Visual Timeline Section */}
                <div className="bg-[#0C0C0D] p-5 border border-border/50 relative overflow-hidden">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Calculated Progress</p>
                      <div className="flex items-center gap-2 mt-1">
                         <p className="text-2xl font-black text-indigo-500 tracking-tighter">{Math.round(progress.real)}%</p>
                         <span className="text-sm text-white/40 font-mono tracking-widest uppercase">REAL</span>
                         <span className="text-white/20 mx-2">|</span>
                         <p className="text-lg font-black text-emerald-500 tracking-tighter">+{Math.round(progress.virtual)}%</p>
                         <span className="text-xs text-white/40 font-mono tracking-widest uppercase">VIRTUAL</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Deadline</p>
                      <p className={`text-lg font-mono font-bold mt-0.5 ${health.color}`}>{formatDate(project.deadline)}</p>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">{daysLeft >= 0 ? `${daysLeft} days remaining` : `${Math.abs(daysLeft)} days overdue`}</p>
                    </div>
                  </div>

                  {/* The Timeline Bar */}
                  <div className="relative h-4 bg-white/5 w-full mt-4 overflows-hidden border border-border/50 flex">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      style={{ width: `${progress.real}%` }}
                    ></div>
                    <div 
                      className="h-full bg-emerald-500/50 transition-all duration-1000"
                      style={{ width: `${Math.min(progress.virtual, 100 - progress.real)}%` }}
                    ></div>
                  </div>
                  
                  {/* Task Markers below timeline */}
                  <div className="flex justify-between items-center mt-4">
                     <p className="text-[10px] font-mono text-white/40">Launch: {formatDate(project.createdAt)}</p>
                     <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3 h-3 text-white/40" />
                        <span className="text-xs font-mono text-white/60">
                          {(project.tasks || []).filter(t => t.status === 'Done').length} / {(project.tasks || []).length} sub-tasks completed
                        </span>
                     </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedProjectIds.includes(project.id) && (
                    <motion.div
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: 'auto', opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       className="overflow-hidden mt-6 border-t border-border pt-6"
                    >
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold tracking-tighter uppercase">Tasks & Deliverables</h4>
                        {authConfig.isAuthenticated && (
                          <Button variant="outline" size="sm" className="text-xs font-mono h-8">
                            <Plus className="w-3 h-3 mr-2" /> Add Task
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {(project.tasks || []).map(task => (
                           <div key={task.id} className="bg-[#0C0C0D] border border-border p-4 flex flex-col md:flex-row justify-between gap-4 md:items-center hover:border-primary/50 transition-colors">
                             <div className="flex-1">
                               <div className="flex items-center gap-2 mb-1">
                                 <p className="font-bold tracking-tight text-sm uppercase">{task.title}</p>
                                 {task.isImportant && <AlertTriangle className="w-3 h-3 text-red-500" />}
                               </div>
                               <p className="text-xs text-white/50">{task.description || 'No description provided.'}</p>
                             </div>
                             <div className="flex flex-wrap gap-4 md:items-center text-xs">
                               <div className="flex flex-col">
                                 <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Status</span>
                                 <span className="font-mono text-white/80">{task.status}</span>
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Priority</span>
                                 <span className="font-mono text-white/80">{task.priority}</span>
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Weight</span>
                                 <span className="font-mono text-white/80">{task.weight}</span>
                               </div>
                             </div>
                           </div>
                        ))}
                        {(project.tasks || []).length === 0 && (
                          <p className="text-sm text-white/40 italic font-mono p-4 border border-dashed border-border text-center">
                            No tasks created for this project yet.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-20 text-center border border-dashed border-border">
             <Activity className="w-12 h-12 text-white/20 mx-auto mb-4" />
             <h3 className="text-xl font-bold uppercase tracking-tight text-white/50">No projects found</h3>
             <p className="text-sm text-white/40 mt-2">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

