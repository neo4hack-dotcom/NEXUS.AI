import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Code, Box, Database, Search, Link as LinkIcon, Blocks } from 'lucide-react';

export function Technologies() {
  const { technologies, authConfig } = useAppStore();
  const [search, setSearch] = useState('');

  const filtered = technologies.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (category: string) => {
    switch (category) {
      case 'framework': return <Blocks className="w-5 h-5 text-blue-500" />;
      case 'library': return <Box className="w-5 h-5 text-emerald-500" />;
      case 'database': return <Database className="w-5 h-5 text-amber-500" />;
      case 'repo': return <Code className="w-5 h-5 text-purple-500" />;
      default: return <Blocks className="w-5 h-5" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Tech Stack</h1>
        </div>
        <div className="flex gap-4">
          <Input 
            placeholder="Search Tech/Repo..." 
            className="w-64 bg-[#111] border-border"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {authConfig.isAuthenticated && (
            <Button variant="secondary">
              New Entry
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border border-[#1A1A1A]">
        {filtered.map((tech, i) => (
          <motion.div
            key={tech.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-6 bg-[#080808] border border-[#1A1A1A] hover:bg-[#111] transition-colors flex flex-col justify-between`}
            style={{ margin: '-1px 0 0 -1px' }}
          >
            <div>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-white/5 inline-flex">
                  {getIcon(tech.category)}
                </div>
                <Badge variant="outline" className="uppercase font-bold tracking-widest text-[10px]">{tech.category}</Badge>
              </div>
              
              <div className="flex items-center justify-between mt-auto">
                <h3 className="font-black text-xl uppercase tracking-tight">{tech.name}</h3>
                {tech.url && (
                  <a href={tech.url} target="_blank" rel="noreferrer" className="text-primary hover:text-white transition-colors">
                    <LinkIcon className="w-4 h-4" />
                  </a>
                )}
              </div>
              <p className="text-sm text-white/40 mt-2">{tech.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
