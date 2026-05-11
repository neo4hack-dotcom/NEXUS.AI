import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Target, Users, Mail, Cpu, Settings, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/AppContext';
import { Button } from '../ui/Button';

export function Sidebar() {
  const navigate = useNavigate();
  const { setAuthConfig, authConfig } = useAppStore();

  const handleLogout = () => {
    setAuthConfig(prev => ({ ...prev, isAuthenticated: false }));
    navigate('/login');
  };

  const routes = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: Target },
    { name: 'Contributors', path: '/contributors', icon: Users },
    { name: 'Communications', path: '/comms', icon: Mail, adminOnly: true },
    { name: 'Tech Stack', path: '/tech', icon: Cpu },
  ];

  return (
    <aside className="w-64 border-r border-[#1A1A1A] flex flex-col justify-between py-8 px-6 hidden md:flex">
      <div>
        <div className="mb-12">
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase leading-none">Nexus<span className="text-[#FF3E00]">.AI</span></h1>
        </div>
        
        <nav className="space-y-6">
          {routes.filter(r => !r.adminOnly || authConfig.isAuthenticated).map((route) => (
            <NavLink
              key={route.path}
              to={route.path}
              className={({ isActive }) => cn(
                "block text-xs font-bold tracking-widest uppercase transition-colors",
                isActive 
                  ? "text-[#FF3E00]" 
                  : "text-white/40 hover:text-white"
              )}
            >
              {route.name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="space-y-6">
        {authConfig.isAuthenticated && (
          <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                "block text-[10px] font-bold tracking-widest uppercase transition-colors",
                isActive 
                  ? "text-[#FF3E00]" 
                  : "text-white/40 hover:text-white"
              )}
            >
              Settings
          </NavLink>
        )}
        {authConfig.isAuthenticated ? (
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-colors text-white/40 hover:text-[#FF3E00]"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        ) : (
          <NavLink 
            to="/login"
            className="flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase transition-colors text-white/40 hover:text-[#FF3E00]"
          >
            Admin Login
          </NavLink>
        )}
        <div className="p-6 bg-[#0C0C0D] border border-border">
          {authConfig.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex flex-shrink-0 items-center justify-center text-primary font-bold text-xs uppercase">
                {authConfig.username.charAt(0)}
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white truncate">{authConfig.username}</p>
                <p className="text-[9px] text-primary uppercase font-mono tracking-widest mt-1">Administrator</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/5 flex flex-shrink-0 items-center justify-center text-white/40 font-bold text-xs uppercase">
                G
              </div>
              <div className="overflow-hidden">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 truncate">Guest Viewer</p>
                <p className="text-[9px] text-white/30 uppercase font-mono tracking-widest mt-1">Read Only</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
