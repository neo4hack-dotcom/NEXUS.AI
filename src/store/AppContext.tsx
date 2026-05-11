import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState, Project, Contributor, Technology, Communication, MailingList, LlmConfig, EmailTemplate, AuthConfig, ProjectStatus, ProjectRole, TaskStatus, TaskPriority } from '../types';
import { generateId } from '../lib/utils';

// Initial Mock Data to populate the app on first load
const defaultState: AppState = {
  authConfig: {
    username: 'admin',
    password: 'MM@2026',
    isAuthenticated: false,
  },
  projects: [
    {
      id: generateId(),
      name: 'NexusAI Agent',
      description: 'Development of the core AI for automated support ticket management.',
      status: ProjectStatus.ACTIVE,
      deadline: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString(),
      owner: 'Emma Dupont',
      isImportant: true,
      members: [
        { userId: '1', role: ProjectRole.OWNER }
      ],
      tasks: [
        { 
          id: generateId(), 
          title: 'Llama3 LLM Fine-tuning', 
          description: '', 
          status: TaskStatus.ONGOING, 
          priority: TaskPriority.HIGH, 
          originalEta: new Date().toISOString(), 
          weight: 5, 
          isImportant: true 
        },
        { 
          id: generateId(), 
          title: 'API Integration', 
          description: '', 
          status: TaskStatus.TODO, 
          priority: TaskPriority.MEDIUM, 
          originalEta: new Date().toISOString(), 
          weight: 3, 
          isImportant: false 
        },
      ],
      technologies: ['1', '2'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
  contributors: [
    {
      id: '1',
      name: 'Emma Dupont',
      role: 'Lead AI Engineer',
      email: 'emma.dupont@company.com',
      team: 'Core AI',
      expectations: 'Deliver the RAG model by Q3.',
      avatar: 'https://i.pravatar.cc/150?u=emma',
    },
    {
      id: '2',
      name: 'Lucas Martin',
      role: 'Fullstack Dev',
      email: 'lucas.martin@company.com',
      team: 'Platform',
      expectations: 'Integrate LLM APIs into the React dashboard.',
      avatar: 'https://i.pravatar.cc/150?u=lucas',
    }
  ],
  technologies: [
    { id: '1', name: 'PyTorch', category: 'framework', description: 'Deep Learning framework' },
    { id: '2', name: 'React', category: 'framework', description: 'UI framework' },
    { id: '3', name: 'nexus-ai-core', category: 'repo', description: 'Main model repository', url: 'https://github.com/org/nexus-ai-core' },
  ],
  communications: [],
  emailTemplates: [
    {
      id: generateId(),
      name: 'Standard Weekly Report',
      type: 'weekly',
      subject: '[Weekly Update] Project Progress {{projectName}}',
      content: 'Hello team,\n\nHere is the summary for the week...\n\nAccomplishments:\n- \n\nBlockers:\n- \n\nNext steps:\n- '
    },
    {
      id: generateId(),
      name: 'Exco Newsletter',
      type: 'exco',
      subject: '[Exco] Progress Summary - AI Strategy',
      content: 'Dear Comex members,\n\nHere is the progress status of our AI initiatives...\n\nImpact & ROI:\n\nCritical Risks:\n\nResource Needs:\n'
    }
  ],
  mailingLists: [
    { id: generateId(), name: 'Entire Company', emails: ['all@company.com'] },
    { id: generateId(), name: 'ExCom', emails: ['ceo@company.com', 'cto@company.com'] },
  ],
  llmConfig: {
    endpoint: 'http://localhost:11434/v1/chat/completions',
    apiKey: 'not-needed-for-local',
    modelName: 'llama3',
    systemPrompt: 'You are an AI assistant expert in project management. Respond in English professionally.'
  }
};

interface AppContextType extends AppState {
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setContributors: React.Dispatch<React.SetStateAction<Contributor[]>>;
  setTechnologies: React.Dispatch<React.SetStateAction<Technology[]>>;
  setCommunications: React.Dispatch<React.SetStateAction<Communication[]>>;
  setMailingLists: React.Dispatch<React.SetStateAction<MailingList[]>>;
  emailTemplates: EmailTemplate[];
  setEmailTemplates: React.Dispatch<React.SetStateAction<EmailTemplate[]>>;
  setLlmConfig: React.Dispatch<React.SetStateAction<LlmConfig>>;
  setAuthConfig: React.Dispatch<React.SetStateAction<AuthConfig>>;
  
  // Helpers
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateProject: (id: string, p: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  exportDataToCSV: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(defaultState.emailTemplates || []);
  const [mailingLists, setMailingLists] = useState<MailingList[]>([]);
  const [llmConfig, setLlmConfig] = useState<LlmConfig>(defaultState.llmConfig);
  const [authConfig, setAuthConfig] = useState<AuthConfig>(defaultState.authConfig);
  
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('nexus_ai_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(parsed.projects || []);
        setContributors(parsed.contributors || []);
        setTechnologies(parsed.technologies || []);
        setCommunications(parsed.communications || []);
        setEmailTemplates(parsed.emailTemplates || defaultState.emailTemplates);
        setMailingLists(parsed.mailingLists || []);
        setLlmConfig(parsed.llmConfig || defaultState.llmConfig);
        
        // Preserve authentication state if saved, else use default credentials
        setAuthConfig({
           username: parsed.authConfig?.username || defaultState.authConfig.username,
           password: parsed.authConfig?.password || defaultState.authConfig.password,
           isAuthenticated: parsed.authConfig?.isAuthenticated || false
        });
      } catch (e) {
        console.error('Failed to parse local storage', e);
      }
    } else {
      setProjects(defaultState.projects);
      setContributors(defaultState.contributors);
      setTechnologies(defaultState.technologies);
      setCommunications(defaultState.communications);
      setEmailTemplates(defaultState.emailTemplates);
      setMailingLists(defaultState.mailingLists);
      setAuthConfig(defaultState.authConfig);
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (!isLoaded) return;
    const stateToSave = {
      projects,
      contributors,
      technologies,
      communications,
      emailTemplates,
      mailingLists,
      llmConfig,
      authConfig
    };
    localStorage.setItem('nexus_ai_state', JSON.stringify(stateToSave));
  }, [projects, contributors, technologies, communications, emailTemplates, mailingLists, llmConfig, authConfig, isLoaded]);

  // Helpers
  const addProject = (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newProject: Project = {
      ...p,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setProjects(prev => [newProject, ...prev]);
  };

  const updateProject = (id: string, p: Partial<Project>) => {
    setProjects(prev => prev.map(proj => 
      proj.id === id ? { ...proj, ...p, updatedAt: new Date().toISOString() } : proj
    ));
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
  };
  
  const exportDataToCSV = () => {
    // Basic CSV export for projects
    const headers = ['ID', 'Name', 'Status', 'Deadline', 'Owner'];
    const rows = projects.map(p => {
      const owner = p.owner || 'Unknown';
      return [p.id, p.name, p.status, p.deadline, owner].join(',');
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "nexus_ai_projects_export.csv");
    document.body.appendChild(link); // Required for FF
    link.click();
    link.remove();
  };

  if (!isLoaded) return null; // or a loading spinner

  return (
    <AppContext.Provider value={{
      projects, setProjects,
      contributors, setContributors,
      technologies, setTechnologies,
      communications, setCommunications,
      emailTemplates, setEmailTemplates,
      mailingLists, setMailingLists,
      llmConfig, setLlmConfig,
      authConfig, setAuthConfig,
      addProject, updateProject, deleteProject, exportDataToCSV
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
}

