import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Mail, Sparkles, Download, Loader2, Copy, FileText, Plus, Users, LayoutTemplate } from 'lucide-react';
import { generateId } from '../lib/utils';
import { EmailTemplate, MailingList } from '../types';

export function Communications() {
  const { mailingLists, setMailingLists, emailTemplates, setEmailTemplates, projects, llmConfig } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'create' | 'templates' | 'lists'>('create');

  // Generator State
  const [commType, setCommType] = useState<'weekly' | 'newsletter' | 'exco'>('weekly');
  const [subject, setSubject] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  // Custom Fields for Generator
  const [weeklyFields, setWeeklyFields] = useState({ accomplishments: '', blockers: '', nextSteps: '' });
  const [newsFields, setNewsFields] = useState({ highlights: '', callToAction: '' });
  const [excoFields, setExcoFields] = useState({ roi: '', risks: '', requests: '' });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  // Template Editing State
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);

  // List Editing State
  const [editingList, setEditingList] = useState<Partial<MailingList> | null>(null);
  const [newEmail, setNewEmail] = useState('');

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedDraft('');
    
    let specificContext = '';
    if (commType === 'weekly') {
      specificContext = `Accomplishments: ${weeklyFields.accomplishments}\nBlockers: ${weeklyFields.blockers}\nNext steps: ${weeklyFields.nextSteps}`;
    } else if (commType === 'newsletter') {
      specificContext = `Highlights: ${newsFields.highlights}\nCall to action: ${newsFields.callToAction}`;
    } else if (commType === 'exco') {
      specificContext = `Impact / ROI: ${excoFields.roi}\nRisks: ${excoFields.risks}\nResource requests: ${excoFields.requests}`;
    }

    const projectsContext = projects.map(p => `[${p.name}] - Status: ${p.status} - Deadline: ${new Date(p.deadline).toLocaleDateString()}`).join('\n');
    
    // Find if a template exists for this type
    const template = emailTemplates.find(t => t.type === commType);
    const templateInstruction = template ? `Use this base template to format your response : \n\nSubject: ${template.subject}\nContent:\n${template.content}` : '';

    let targetProjectContext = '';
    if (selectedProjectId) {
      const p = projects.find(p => p.id === selectedProjectId);
      if (p) {
        targetProjectContext = `FOCUS PROJECT METADATA:
- Name: ${p.name}
- Description: ${p.description}
- Status: ${p.status}
- Deadline: ${new Date(p.deadline).toLocaleDateString()}
- Tasks (Pending): ${(p.tasks || []).filter(t => t.status !== 'Done').map(t => t.title).join(', ')}
`;
      }
    }

    const prompt = `Write a corporate communication of type: "${commType}". 
Main topic (optional): "${subject}".
Include these specific context details:
${specificContext}

${targetProjectContext}

Active projects status (use if relevant):
${projectsContext}

${templateInstruction}

Generate a clear, professional email in English, ready to be copied and pasted, nicely formatted with line breaks.`;

    try {
      if (llmConfig.apiKey === 'not-needed-for-local' && llmConfig.endpoint.includes('localhost')) {
         // Simulate local if not truly running
         setTimeout(() => {
           setGeneratedDraft(`Subject: ${commType} Updates\n\nHello,\n\nHere is the generated draft (Local simulation since no API backend was detected on ${llmConfig.endpoint}).\n\nContext: ${specificContext}`);
           setIsGenerating(false);
         }, 1500);
         return;
      }

      const response = await fetch(llmConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(llmConfig.apiKey && llmConfig.apiKey !== 'not-needed-for-local' ? { 'Authorization': `Bearer ${llmConfig.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: llmConfig.modelName,
          messages: [
            { role: "system", content: llmConfig.systemPrompt || "You are an expert corporate communications AI assistant." },
            { role: "user", content: prompt }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedDraft(data.choices[0]?.message?.content || 'Error during generation (empty response).');
    } catch (error) {
      console.error("Local LLM Error:", error);
      setGeneratedDraft(`Local Simulation (API connection error) : \n\nSubject: ${subject}\n\nType: ${commType}\n\nDetails:\n${specificContext}\n\n(Configure a valid endpoint in Settings to use a real AI.)`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedDraft);
    setCopySuccess('Copied!');
    setTimeout(() => setCopySuccess(''), 2000);
  };

  const exportToEML = (subject: string, body: string, recipientListIndex: number = 0) => {
    const list = mailingLists[recipientListIndex];
    let to = list ? list.emails.join(',') : '';
    
    const emlContent = `To: ${to}\nSubject: ${subject}\nX-Unsent: 1\nContent-Type: text/plain; charset=utf-8\n\n${body}`;
    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.eml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveTemplate = () => {
    if (!editingTemplate?.name) return;
    
    if (editingTemplate.id) {
       setEmailTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate as EmailTemplate : t));
    } else {
       setEmailTemplates(prev => [...prev, { ...editingTemplate, id: generateId() } as EmailTemplate]);
    }
    setEditingTemplate(null);
  };

  const saveMailingList = () => {
    if (!editingList?.name) return;
    if (editingList.id) {
      setMailingLists(prev => prev.map(l => l.id === editingList.id ? editingList as MailingList : l));
    } else {
      setMailingLists(prev => [...prev, { ...editingList, id: generateId(), emails: editingList.emails || [] } as MailingList]);
    }
    setEditingList(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 max-w-7xl mx-auto pb-20"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
        <div>
          <h1 className="text-5xl font-black tracking-tighter uppercase leading-none">Comms Hub</h1>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-border pb-4 mb-6 overflows-x-auto">
        <Button 
          variant={activeTab === 'create' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('create')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <Sparkles className="w-4 h-4 mr-2" /> Generate
        </Button>
        <Button 
          variant={activeTab === 'templates' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('templates')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <LayoutTemplate className="w-4 h-4 mr-2" /> Templates
        </Button>
        <Button 
          variant={activeTab === 'lists' ? 'default' : 'ghost'} 
          onClick={() => setActiveTab('lists')}
          className="uppercase tracking-widest text-[10px] font-bold"
        >
          <Users className="w-4 h-4 mr-2" /> Email Lists
        </Button>
      </div>

      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border bg-[#0C0C0D]">
            <CardHeader className="bg-primary/5 border-b border-primary/20 p-6 flex flex-row items-center gap-2">
               <Sparkles className="w-6 h-6 text-primary" />
               <CardTitle className="text-primary">AI Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Communication Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant={commType === 'weekly' ? 'default' : 'outline'} onClick={() => setCommType('weekly')} className="text-xs">Weekly</Button>
                  <Button variant={commType === 'newsletter' ? 'default' : 'outline'} onClick={() => setCommType('newsletter')} className="text-xs">Newsletter</Button>
                  <Button variant={commType === 'exco' ? 'default' : 'outline'} onClick={() => setCommType('exco')} className="text-xs">Exco</Button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target Project (Optional)</label>
                <select 
                   className="flex h-10 w-full border border-border bg-[#0C0C0D] px-4 py-2 text-sm focus-visible:outline-none"
                   value={selectedProjectId}
                   onChange={e => {
                     setSelectedProjectId(e.target.value);
                     const p = projects.find(proj => proj.id === e.target.value);
                     if (p) {
                       if (!subject) setSubject(`Project Update: ${p.name}`);
                       
                       const completedTasks = (p.tasks || []).filter(t => t.status === 'Done').map(t => t.title).join(', ');
                       const blockedTasks = (p.tasks || []).filter(t => t.status === 'Blocked').map(t => t.title).join(', ');
                       const todoTasks = (p.tasks || []).filter(t => t.status === 'To Do' || t.status === 'In Progress').map(t => t.title).join(', ');
                       
                       if (commType === 'weekly') {
                         setWeeklyFields({
                           accomplishments: completedTasks || p.description,
                           blockers: blockedTasks || 'None',
                           nextSteps: todoTasks || 'Continue execution'
                         });
                       } else if (commType === 'exco') {
                         setExcoFields({
                           roi: `Delivery of ${p.name}`,
                           risks: blockedTasks || p.pauseReason || 'None',
                           requests: 'Maintain current budget'
                         });
                       } else if (commType === 'newsletter') {
                         setNewsFields({
                           highlights: `${p.name} status: ${p.status} - ${completedTasks}`,
                           callToAction: 'Check out the new features'
                         });
                       }
                     }
                   }}
                >
                   <option value="">-- General (No specific project) --</option>
                   {projects.map(p => (
                     <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Main Topic</label>
                <Input placeholder="Title or focus for the week..." value={subject} onChange={e => setSubject(e.target.value)} />
              </div>

              {commType === 'weekly' && (
                <div className="space-y-4 border-l-2 border-primary/50 pl-4 py-2 mt-4">
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Key Accomplishments</label>
                     <Input placeholder="What was completed..." value={weeklyFields.accomplishments} onChange={e => setWeeklyFields(f => ({...f, accomplishments: e.target.value}))}/>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Blockers / Alerts</label>
                     <Input placeholder="Delays, tech issues..." value={weeklyFields.blockers} onChange={e => setWeeklyFields(f => ({...f, blockers: e.target.value}))}/>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Next Steps</label>
                     <Input placeholder="Focus for next week..." value={weeklyFields.nextSteps} onChange={e => setWeeklyFields(f => ({...f, nextSteps: e.target.value}))}/>
                   </div>
                </div>
              )}

              {commType === 'newsletter' && (
                <div className="space-y-4 border-l-2 border-primary/50 pl-4 py-2 mt-4">
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Highlights</label>
                     <Input placeholder="Big updates this month..." value={newsFields.highlights} onChange={e => setNewsFields(f => ({...f, highlights: e.target.value}))}/>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Call to Action</label>
                     <Input placeholder="Test the new feature..." value={newsFields.callToAction} onChange={e => setNewsFields(f => ({...f, callToAction: e.target.value}))}/>
                   </div>
                </div>
              )}

              {commType === 'exco' && (
                   <div className="space-y-4 border-l-2 border-primary/50 pl-4 py-2 mt-4">
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Impact & ROI Focus</label>
                     <Input placeholder="Productivity gains..." value={excoFields.roi} onChange={e => setExcoFields(f => ({...f, roi: e.target.value}))}/>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Strategic Risks</label>
                     <Input placeholder="Adoption, budget, resources..." value={excoFields.risks} onChange={e => setExcoFields(f => ({...f, risks: e.target.value}))}/>
                   </div>
                   <div className="space-y-2">
                     <label className="text-xs text-white/60">Resource Needs</label>
                     <Input placeholder="Budget ++, Recruitment..." value={excoFields.requests} onChange={e => setExcoFields(f => ({...f, requests: e.target.value}))}/>
                   </div>
                </div>
              )}

              <Button className="w-full mt-6 py-4 font-bold tracking-widest uppercase text-xs" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {isGenerating ? "Generating..." : "Generate Communication"}
              </Button>
            </CardContent>
          </Card>

          <Card className={`${generatedDraft ? 'border-primary' : 'border-border'} bg-[#111] overflow-hidden flex flex-col`}>
            <CardHeader className="bg-primary/5 border-b border-border p-6 flex flex-row items-center justify-between">
              <CardTitle>Generated Draft</CardTitle>
              {generatedDraft && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportToEML(subject || `Communication: ${commType}`, generatedDraft)}>
                     <Download className="w-4 h-4 mr-2" /> Outlook (.eml)
                  </Button>
                  <Button variant={copySuccess ? "default" : "outline"} size="sm" onClick={handleCopy}>
                    {copySuccess ? copySuccess : <><Copy className="w-4 h-4" /></>}
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 relative">
              {generatedDraft ? (
                <textarea 
                  className="w-full h-full min-h-[400px] p-6 bg-transparent text-sm leading-relaxed focus:outline-none resize-none font-mono text-white/80"
                  value={generatedDraft}
                  onChange={(e) => setGeneratedDraft(e.target.value)}
                />
              ) : (
                <div className="h-full min-h-[400px] flex items-center justify-center p-6 text-center text-white/20">
                  <div className="space-y-2">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="text-xs uppercase tracking-widest font-bold">Draft Preview</p>
                    <p className="text-xs">Fill in the fields and generate to preview.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
             <Button variant="outline" className="w-full border-dashed py-6 text-xs uppercase tracking-widest" onClick={() => setEditingTemplate({ type: 'weekly', name: 'New Template', subject: '', content: '' })}>
               <Plus className="w-4 h-4 mr-2" /> Create Template
             </Button>
             {emailTemplates.map(t => (
               <div key={t.id} 
                    className={`p-4 border cursor-pointer hover:border-primary transition-colors ${editingTemplate?.id === t.id ? 'border-primary bg-primary/5' : 'border-border bg-[#0C0C0D]'}`}
                    onClick={() => setEditingTemplate(t)}
                >
                 <p className="font-bold uppercase tracking-tight text-sm">{t.name}</p>
                 <p className="text-[10px] text-primary/70 uppercase tracking-widest mt-1">Type: {t.type}</p>
               </div>
             ))}
          </div>
          
          <div className="lg:col-span-2">
             {editingTemplate ? (
               <Card className="border-border bg-[#111]">
                 <CardHeader className="border-b border-border">
                   <CardTitle>Edit: {editingTemplate.name}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Template Name</label>
                     <Input value={editingTemplate.name || ''} onChange={e => setEditingTemplate({...editingTemplate, name: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Type</label>
                     <select className="flex h-10 w-full border border-border bg-[#0C0C0D] px-4 py-2 text-sm focus-visible:outline-none" 
                             value={editingTemplate.type} 
                             onChange={e => setEditingTemplate({...editingTemplate, type: e.target.value as any})}
                     >
                       <option value="weekly">Weekly</option>
                       <option value="newsletter">Newsletter</option>
                       <option value="exco">Exco</option>
                       <option value="info">Info / Other</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email Subject</label>
                     <Input value={editingTemplate.subject || ''} onChange={e => setEditingTemplate({...editingTemplate, subject: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Content ({`Useful vars: {{projectName}}`})</label>
                     <textarea 
                       className="w-full min-h-[250px] p-4 bg-[#0C0C0D] border border-border text-sm font-mono text-white/80 focus:outline-primary"
                       value={editingTemplate.content || ''}
                       onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                     />
                   </div>
                   <div className="flex gap-2 pt-4">
                     <Button onClick={saveTemplate}>Save Template</Button>
                     <Button variant="outline" onClick={() => exportToEML(editingTemplate.subject || '', editingTemplate.content || '')}>
                       <Download className="w-4 h-4 mr-2" /> Export .eml
                     </Button>
                   </div>
                 </CardContent>
               </Card>
             ) : (
               <div className="h-full flex items-center justify-center border border-dashed border-border p-12 text-center text-white/40">
                  Select a template to edit or create a new one.
               </div>
             )}
          </div>
        </div>
      )}

      {activeTab === 'lists' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-1 space-y-4">
             <Button variant="outline" className="w-full border-dashed py-6 text-xs uppercase tracking-widest" onClick={() => setEditingList({ name: 'New List', emails: [] })}>
               <Plus className="w-4 h-4 mr-2" /> Create List
             </Button>
             {mailingLists.map(l => (
               <div key={l.id} 
                    className={`p-4 border cursor-pointer hover:border-primary transition-colors flex justify-between items-center ${editingList?.id === l.id ? 'border-primary bg-primary/5' : 'border-border bg-[#0C0C0D]'}`}
                    onClick={() => setEditingList(l)}
                >
                 <div>
                   <p className="font-bold uppercase tracking-tight text-sm">{l.name}</p>
                   <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">{l.emails.length} contacts</p>
                 </div>
                 <Mail className="w-4 h-4 text-white/20" />
               </div>
             ))}
          </div>

          <div className="lg:col-span-2">
             {editingList ? (
               <Card className="border-border bg-[#111]">
                 <CardHeader className="border-b border-border">
                   <CardTitle>List: {editingList.name}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-6 space-y-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">List Name</label>
                     <Input value={editingList.name || ''} onChange={e => setEditingList({...editingList, name: e.target.value})} />
                   </div>
                   
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Members ({editingList.emails?.length || 0})</label>
                     <div className="bg-[#0C0C0D] border border-border p-4 space-y-2 max-h-[300px] overflow-y-auto">
                       {editingList.emails?.map((email, idx) => (
                         <div key={idx} className="flex justify-between items-center bg-[#111] p-2 border border-border">
                           <span className="text-sm font-mono text-white/80">{email}</span>
                           <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-400" onClick={() => {
                             const newList = [...(editingList.emails || [])];
                             newList.splice(idx, 1);
                             setEditingList({...editingList, emails: newList});
                           }}>x</Button>
                         </div>
                       ))}
                       {(!editingList.emails || editingList.emails.length === 0) && (
                         <p className="text-xs text-white/40 italic text-center py-4">No members.</p>
                       )}
                     </div>
                   </div>

                   <div className="flex gap-2">
                     <Input placeholder="new@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} 
                       onKeyDown={(e) => {
                         if(e.key === 'Enter' && newEmail) {
                           setEditingList({...editingList, emails: [...(editingList.emails || []), newEmail]});
                           setNewEmail('');
                         }
                       }}
                     />
                     <Button variant="secondary" onClick={() => {
                       if(newEmail) {
                         setEditingList({...editingList, emails: [...(editingList.emails || []), newEmail]});
                         setNewEmail('');
                       }
                     }}>Add</Button>
                   </div>
                   
                   <div className="pt-4 border-t border-border flex justify-between">
                     <Button onClick={saveMailingList}>Save List</Button>
                     {editingList.id && (
                       <Button variant="destructive" onClick={() => {
                         setMailingLists(prev => prev.filter(l => l.id !== editingList.id));
                         setEditingList(null);
                       }}>Delete</Button>
                     )}
                   </div>
                 </CardContent>
               </Card>
             ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-border p-12 text-center text-white/40">
                  Select a mailing list to manage.
               </div>
             )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
