import type { VisibilityType } from '@/components/visibility-selector';

export function getDefaultChatVisibility(): VisibilityType {
  const envVisibility = process.env.DEFAULT_CHAT_VISIBILITY;
  
  // Validate the environment variable value
  if (envVisibility === 'public' || envVisibility === 'private') {
    return envVisibility;
  }
  
  // Default to private if not set or invalid
  return 'private';
}