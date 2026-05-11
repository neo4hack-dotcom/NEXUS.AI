import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Save, ShieldAlert, Cpu, Key, Users, RefreshCw, CheckCircle2, XCircle, Plus, Trash2 } from 'lucide-react';
import { Contributor } from '../types';
import { generateId } from '../lib/utils';
import { cn } from '../lib/utils';

export function Settings() {
  const { llmConfig, setLlmConfig, authConfig, setAuthConfig, contributors, setContributors } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'llm' | 'security' | 'users'>('llm');

  const [formData, setFormData] = useState(llmConfig);
  const [authData, setAuthData] = useState({ username: authConfig.username, password: authConfig.password });
  
  const [saved, setSaved] = useState(false);
  const [authSaved, setAuthSaved] = useState(false);

  // User Management
  const [editingUser, setEditingUser] = useState<Partial<Contributor> | null>(null);

  // LLM Test
  const [testStatus, setTestStatus] = useState<{status: 'idle' | 'testing' | 'success' | 'error', message: string, models: string[]}>({status: 'idle', message: '', models: []});

  const handleSave = () => {
    setLlmConfig(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleAuthSave = () => {
    setAuthConfig(prev => ({ ...prev, username: authData.username, password: authData.password }));
    setAuthSaved(true);
    setTimeout(() => setAuthSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setTestStatus({ status: 'testing', message: 'Testing connection...', models: [] });
    try {
      // Typically /v1/models is what compatible endpoints use. If the endpoint is /v1/chat/completions, we try to strip it.
      const baseUrl = formData.endpoint.replace(/\/chat\/completions$/, '/models');
      
      const response = await fetch(baseUrl, {
        method: 'GET',
        headers: formData.apiKey ? { 'Authorization': `Bearer ${formData.apiKey}` } : undefined
      });

      if (response.ok) {
        const data = await response.json();
        const modelNames = data.data ? data.data.map((m: any) => m.id) : (data.models ? data.models.map((m: any) => m.name || m.id) : ['Object returned but no standard models format.']);
        setTestStatus({ status: 'success', message: 'Connection successful!', models: modelNames });
      } else {
        setTestStatus({ status: 'error', message: `Failed with status: ${response.status}`, models: [] });
      }
    } catch(err: any) {
      setTestStatus({ status: 'error', message: `Error: ${err.message}`, models: [] });
    }
  };

  const saveUser = () => {
    if (!editingUser) return;
    if (editingUser.id) {
       setContributors(contributors.map(c => c.id === editingUser.id ? { ...c, ...editingUser, name: `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() || editingUser.name } as Contributor : c));
    } else {
       setContributors([...contributors, { 
         ...editingUser, 
         id: generateId(),
         name: `${editingUser.firstName || ''} ${editingUser.lastName || ''}`.trim() || editingUser.name || 'Unknown',
         role: editingUser.role || 'Contributor',
         email: editingUser.email || '',
         team: editingUser.team || 'Unassigned',
         expectations: editingUser.expectations || ''
       } as Contributor]);
    }
    setEditingUser(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-5xl mx-auto pb-20"
    >
      <div className="mb-8">
        <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Settings</h1>
      </div>

      <div className="bg-primary/10 border border-primary/20 p-6 flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-4 text-primary mb-8">
        <ShieldAlert className="w-6 h-6 shrink-0" />
        <div>
           <p className="font-bold uppercase tracking-tight mb-2">Admin View</p>
           <p className="text-sm">You are logged in as an administrator. Changes made here affect the entire NexusAI instance.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-border pb-4 w-full overflow-x-auto mb-6">
        <Button 
          variant={activeTab === 'llm' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('llm')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <Cpu className="w-4 h-4 mr-2" /> Local LLM Config
        </Button>
        <Button 
          variant={activeTab === 'users' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('users')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <Users className="w-4 h-4 mr-2" /> Manage Users
        </Button>
        <Button 
          variant={activeTab === 'security' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('security')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <Key className="w-4 h-4 mr-2" /> App Security
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeTab === 'llm' && (
          <Card className="border-border bg-[#0C0C0D] lg:col-span-2">
            <CardHeader className="border-b border-border p-6 flex flex-row items-center gap-4">
              <Cpu className="w-6 h-6 text-primary" />
              <div>
                 <CardTitle>Local LLM Config</CardTitle>
                 <CardDescription className="mt-2 text-white/40 normal-case tracking-normal font-sans text-sm">
                   Configure OpenAI compatible API endpoint (Ollama, LM Studio, etc.)
                 </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">API Endpoint (URL)</label>
                    <Input 
                      value={formData.endpoint} 
                      onChange={e => setFormData({...formData, endpoint: e.target.value})}
                      placeholder="http://localhost:11434/v1/chat/completions" 
                    />
                    <p className="text-[10px] text-white/40 font-mono">Ex: Ollama local endpoint or LM Studio server.</p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Model</label>
                    <Input 
                      value={formData.modelName} 
                      onChange={e => setFormData({...formData, modelName: e.target.value})}
                      placeholder="llama3" 
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">API Key (Optional)</label>
                    <Input 
                      type="password"
                      value={formData.apiKey} 
                      onChange={e => setFormData({...formData, apiKey: e.target.value})}
                      placeholder="sk-..." 
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Prompt</label>
                    <textarea 
                      className="flex min-h-[170px] w-full border border-border bg-[#111] px-4 py-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary resize-y"
                      value={formData.systemPrompt} 
                      onChange={e => setFormData({...formData, systemPrompt: e.target.value})}
                    />
                  </div>
                  
                  <div className="p-4 bg-[#111] border border-border flex flex-col gap-4">
                     <p className="text-[10px] font-bold uppercase tracking-widest">Connection Test</p>
                     <div className="flex items-center gap-4">
                       <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testStatus.status === 'testing'}>
                         {testStatus.status === 'testing' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                         Test Connection
                       </Button>
                       {testStatus.status === 'success' && <div className="flex items-center text-emerald-500 text-xs"><CheckCircle2 className="w-4 h-4 mr-1"/> {testStatus.message}</div>}
                       {testStatus.status === 'error' && <div className="flex items-center text-red-500 text-xs"><XCircle className="w-4 h-4 mr-1"/> {testStatus.message}</div>}
                     </div>
                     {testStatus.models.length > 0 && (
                        <div className="mt-2 space-y-2">
                           <p className="text-[10px] text-white/40 uppercase tracking-widest">Available Models</p>
                           <div className="flex flex-wrap gap-2">
                             {testStatus.models.map(m => (
                               <span key={m} className="px-2 py-1 bg-white/5 border border-white/10 text-xs font-mono rounded-sm select-all cursor-pointer hover:bg-white/10" onClick={() => setFormData({...formData, modelName: m})}>{m}</span>
                             ))}
                           </div>
                        </div>
                     )}
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} className="mt-8 py-3 w-full sm:w-auto text-xs font-bold uppercase tracking-widest">
                <Save className="w-4 h-4 mr-2" />
                {saved ? "Saved!" : "Save Config"}
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === 'users' && (
          <div className="col-span-1 lg:col-span-2 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Button variant="outline" className="w-full border-dashed py-6 text-xs uppercase tracking-widest" onClick={() => setEditingUser({ name: '', firstName: '', lastName: '', team: '', uid: '', password: '', role: 'Contributor' })}>
                <Plus className="w-4 h-4 mr-2" /> Add User
              </Button>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {contributors.map(c => (
                  <div key={c.id} 
                    className={cn(
                      "p-4 border cursor-pointer transition-colors bg-[#0C0C0D]",
                      editingUser?.id === c.id ? "border-primary" : "border-border hover:border-primary/50"
                    )}
                    onClick={() => setEditingUser(c)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <p className="text-sm font-bold uppercase tracking-tighter truncate">{c.name}</p>
                        <p className="text-[10px] font-mono text-white/50">{c.uid ? `UID: ${c.uid}` : c.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2">
              {editingUser ? (
                <Card className="border-border bg-[#111]">
                  <CardHeader className="border-b border-border">
                    <CardTitle>{editingUser.id ? 'Edit User' : 'New User'}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">First Name (Prénom)</label>
                        <Input value={editingUser.firstName || ''} onChange={e => setEditingUser({...editingUser, firstName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last Name (Nom)</label>
                        <Input value={editingUser.lastName || ''} onChange={e => setEditingUser({...editingUser, lastName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">UID</label>
                        <Input value={editingUser.uid || ''} onChange={e => setEditingUser({...editingUser, uid: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Team (Équipe)</label>
                        <Input value={editingUser.team || ''} onChange={e => setEditingUser({...editingUser, team: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Password (Mot de passe)</label>
                        <Input type="password" value={editingUser.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} placeholder="********" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Role</label>
                        <Input value={editingUser.role || ''} onChange={e => setEditingUser({...editingUser, role: e.target.value})} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email</label>
                        <Input value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} />
                      </div>
                    </div>
                    
                    <div className="flex justify-between pt-4 border-t border-border border-dashed">
                      <Button onClick={saveUser}>Save User</Button>
                      {editingUser.id && (
                        <Button variant="destructive" size="icon" onClick={() => {
                          setContributors(contributors.filter(c => c.id !== editingUser.id));
                          setEditingUser(null);
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="h-full border border-dashed border-border p-12 text-center text-white/40 flex items-center justify-center min-h-[300px]">
                  Select a user or create a new one to edit details.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <Card className="border-border bg-[#0C0C0D] h-fit">
            <CardHeader className="border-b border-border p-6 flex flex-row items-center gap-4">
              <Key className="w-6 h-6 text-primary" />
              <div>
                 <CardTitle>Security & Access</CardTitle>
                 <CardDescription className="mt-2 text-white/40 normal-case tracking-normal font-sans text-sm">
                   Update master admin credentials
                 </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admin Username</label>
                <Input 
                  value={authData.username || ''} 
                  onChange={e => setAuthData({...authData, username: e.target.value})}
                />
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admin Password</label>
                <Input 
                  type="password"
                  value={authData.password || ''} 
                  onChange={e => setAuthData({...authData, password: e.target.value})}
                />
              </div>

              <Button onClick={handleAuthSave} className="mt-8 py-3 w-full sm:w-auto text-xs font-bold uppercase tracking-widest">
                <Save className="w-4 h-4 mr-2" />
                {authSaved ? "Saved!" : "Update Credentials"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
