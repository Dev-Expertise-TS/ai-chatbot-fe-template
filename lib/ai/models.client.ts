'use client';

import { useState, useEffect } from 'react';
import type { ChatModel } from './models';

// Default models for initial render to prevent hydration mismatch
export const DEFAULT_MODELS: ChatModel[] = [
  {
    id: 'default',
    name: 'Loading...',
    description: 'Loading available models',
    provider: 'openai',
    type: 'chat',
  }
];

export function useAvailableModels() {
  const [models, setModels] = useState<ChatModel[]>(DEFAULT_MODELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/models')
      .then(res => res.json())
      .then(data => {
        if (data.models && data.models.length > 0) {
          setModels(data.models);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch models:', err);
        setError('Failed to load models');
        setLoading(false);
      });
  }, []);

  return { models, loading, error };
}