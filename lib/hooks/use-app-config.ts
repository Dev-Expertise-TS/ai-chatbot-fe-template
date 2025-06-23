'use client';

import { useState, useEffect } from 'react';

interface AppConfig {
  hideModelSelector: boolean;
  hideVisibilitySelector: boolean;
  hideSuggestedActions: boolean;
  hideSidebarLogo: boolean;
  defaultChatVisibility: 'private' | 'public';
}

const defaultConfig: AppConfig = {
  hideModelSelector: false,
  hideVisibilitySelector: false,
  hideSuggestedActions: false,
  hideSidebarLogo: false,
  defaultChatVisibility: 'private',
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        setConfig(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch app config:', err);
        setLoading(false);
      });
  }, []);

  return { config, loading };
}