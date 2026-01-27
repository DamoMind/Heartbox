import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Organization } from '@/types';
import { getSettings, saveSettings } from '@/services/db';

interface OrganizationContextType {
  organizations: Organization[];
  currentOrganization: Organization | null;
  loading: boolean;
  setCurrentOrganization: (org: Organization) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (org: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Organization>;
  updateOrganization: (id: string, updates: Partial<Organization>) => Promise<void>;
  deleteOrganization: (id: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | null>(null);

const API_URL = import.meta.env.VITE_API_URL || '';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrganization, setCurrentOrgState] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/organizations`);
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data);
        return data as Organization[];
      }
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    }
    return [];
  }, []);

  const refreshOrganizations = useCallback(async () => {
    await fetchOrganizations();
  }, [fetchOrganizations]);

  // Load organizations and restore current selection
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const orgs = await fetchOrganizations();
        const settings = await getSettings();
        
        // Find the previously selected organization or use default
        let currentOrg = orgs.find(o => o.id === settings.currentOrganizationId);
        if (!currentOrg) {
          currentOrg = orgs.find(o => o.isDefault) || orgs[0];
        }
        
        if (currentOrg) {
          setCurrentOrgState(currentOrg);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchOrganizations]);

  const setCurrentOrganization = useCallback(async (org: Organization) => {
    setCurrentOrgState(org);
    await saveSettings({ currentOrganizationId: org.id });
  }, []);

  const createOrganization = useCallback(async (
    orgData: Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Organization> => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newOrg: Organization = {
      ...orgData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const response = await fetch(`${API_URL}/api/organizations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrg),
    });

    if (!response.ok) {
      throw new Error('Failed to create organization');
    }

    setOrganizations(prev => [...prev, newOrg]);
    return newOrg;
  }, []);

  const updateOrganization = useCallback(async (id: string, updates: Partial<Organization>) => {
    const response = await fetch(`${API_URL}/api/organizations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error('Failed to update organization');
    }

    setOrganizations(prev => prev.map(org => 
      org.id === id ? { ...org, ...updates, updatedAt: new Date().toISOString() } : org
    ));

    // Update current org if it was the one updated
    if (currentOrganization?.id === id) {
      setCurrentOrgState(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [currentOrganization]);

  const deleteOrganization = useCallback(async (id: string) => {
    const response = await fetch(`${API_URL}/api/organizations/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete organization');
    }

    setOrganizations(prev => {
      const updated = prev.filter(org => org.id !== id);
      // If deleted current, switch to default
      if (currentOrganization?.id === id) {
        const defaultOrg = updated.find(o => o.isDefault) || updated[0];
        if (defaultOrg) {
          setCurrentOrgState(defaultOrg);
          saveSettings({ currentOrganizationId: defaultOrg.id });
        }
      }
      return updated;
    });
  }, [currentOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        loading,
        setCurrentOrganization,
        refreshOrganizations,
        createOrganization,
        updateOrganization,
        deleteOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
