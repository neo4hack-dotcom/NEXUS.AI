import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Mail, Plus, MapPin, Briefcase } from 'lucide-react';

export function Contributors() {
  const { contributors, authConfig } = useAppStore();

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Contributors</h1>
        </div>
        {authConfig.isAuthenticated && (
          <Button variant="secondary">
            <Plus className="w-4 h-4 mr-2"/>
            Invite
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contributors.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="h-full bg-[#111] border-border">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-white/10 flex items-center justify-center text-xl font-bold text-white shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl uppercase tracking-tighter">{c.name}</h3>
                    <p className="text-primary text-[10px] uppercase font-bold tracking-widest">{c.role}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center text-xs text-white/40">
                        <Briefcase className="w-3 h-3 mr-2" />
                        {c.team}
                      </div>
                      <div className="flex items-center text-xs text-white/40">
                        <Mail className="w-3 h-3 mr-2" />
                        {c.email}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6 pt-4 border-t border-[#1A1A1A]">
                  <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#FF3E00] mb-3">Expectations & Goals</h4>
                  <p className="text-sm border-l-2 border-white/20 pl-3 italic text-white/80 leading-relaxed">
                    "{c.expectations}"
                  </p>
                </div>
                
                {authConfig.isAuthenticated && (
                  <div className="mt-6 pt-6 flex gap-2">
                    <Button variant="outline" className="w-full py-2">Update Status</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
