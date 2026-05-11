import React from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Target, Users, Cpu, Activity, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';

export function Dashboard() {
  const { projects, contributors, technologies, exportDataToCSV } = useAppStore();

  const stats = [
    { name: 'Active Projects', value: projects.filter(p => !['completed', 'on_hold'].includes(p.status)).length, icon: Target, color: 'text-blue-500' },
    { name: 'Contributors', value: contributors.length, icon: Users, color: 'text-emerald-500' },
    { name: 'Technologies', value: technologies.length, icon: Cpu, color: 'text-amber-500' },
    { name: 'Tasks In Progress', value: projects.flatMap(p => p.tasks).filter(t => t.status === 'in_progress').length, icon: Activity, color: 'text-purple-500' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase leading-none">Global Dashboard</h1>
          <p className="text-[10px] tracking-widest font-bold text-muted-foreground uppercase mt-2">Centralized management of your AI projects & teams.</p>
        </div>
        <Button onClick={exportDataToCSV} variant="secondary" className="shrink-0 bg-white text-black">
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-border">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{stat.name}</p>
                  <p className="text-4xl font-mono">{stat.value}</p>
                </div>
                <div className={`p-4 bg-[#111] border border-border`}>
                  <stat.icon className="w-6 h-6 text-white/60" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 relative border-border bg-[#0C0C0D]">
          <CardHeader className="border-b border-border/50 p-6">
            <CardTitle className="text-3xl font-black uppercase tracking-tighter">Recent Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {projects.slice(0, 5).map(project => (
                <div key={project.id} className="p-6 bg-[#111] border-l-4 border-l-[#FF3E00] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <h4 className="text-lg font-bold">{project.name}</h4>
                    <p className="text-sm text-white/40 line-clamp-1 mt-1">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-8 text-right">
                    <div className="text-left w-24">
                       <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Status</p>
                       <p className="text-xs font-bold text-white uppercase">{project.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No projects available right now.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0C0C0D] border-border">
          <CardHeader className="border-b border-border/50 p-6">
            <CardTitle className="text-2xl font-black uppercase tracking-tighter text-white">Contributors</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {contributors.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 flex items-center justify-center text-xs font-bold text-white">
                    {c.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-bold uppercase">{c.name}</p>
                    <p className="text-[10px] text-white/40">{c.role} • {c.team}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
