import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/AppContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Shield } from 'lucide-react';

export function Login() {
  const { authConfig, setAuthConfig } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === authConfig.username && password === authConfig.password) {
      setAuthConfig(prev => ({ ...prev, isAuthenticated: true }));
      navigate('/');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] p-8 border border-border"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#FF3E00]/10 flex items-center justify-center text-[#FF3E00] rounded-full mb-4">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">NexusAI Admin</h1>
          <p className="text-white/40 text-sm mt-2 font-mono uppercase tracking-widest">Restricted Access</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Username</label>
            <Input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="bg-[#0C0C0D] border-border h-12"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Password</label>
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="bg-[#0C0C0D] border-border h-12"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm font-bold">{error}</p>}

          <Button type="submit" className="w-full h-12 font-bold uppercase tracking-widest text-xs">
            Authenticate
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
