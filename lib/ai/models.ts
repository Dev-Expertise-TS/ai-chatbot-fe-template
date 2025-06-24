export type ModelProvider = 'xai' | 'openai' | 'anthropic' | 'cxdm';
export type ModelType = 'chat' | 'reasoning' | 'title' | 'artifact' | 'image';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: ModelProvider;
  type: ModelType;
}

export const XAI_MODELS: ChatModel[] = [
  {
    id: 'grok-2-vision-1212',
    name: 'Grok 2 Vision',
    description: 'Vision-enabled chat model from xAI',
    provider: 'xai',
    type: 'chat',
  },
  {
    id: 'grok-2-1212',
    name: 'Grok 2',
    description: 'Advanced chat model from xAI',
    provider: 'xai',
    type: 'chat',
  },
  {
    id: 'grok-3-mini-beta',
    name: 'Grok 3 Mini (Beta)',
    description: 'Advanced reasoning model from xAI',
    provider: 'xai',
    type: 'reasoning',
  },
];

export const OPENAI_MODELS: ChatModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most capable GPT-4 model with vision',
    provider: 'openai',
    type: 'chat',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Small, fast model for lightweight tasks',
    provider: 'openai',
    type: 'chat',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'GPT-4 Turbo with vision capabilities',
    provider: 'openai',
    type: 'chat',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast, inexpensive model for simple tasks',
    provider: 'openai',
    type: 'chat',
  },
  {
    id: 'o1',
    name: 'o1',
    description: 'Advanced reasoning model from OpenAI',
    provider: 'openai',
    type: 'reasoning',
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    description: 'Smaller reasoning model from OpenAI',
    provider: 'openai',
    type: 'reasoning',
  },
];

export const ANTHROPIC_MODELS: ChatModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model',
    provider: 'anthropic',
    type: 'chat',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and efficient Claude model',
    provider: 'anthropic',
    type: 'chat',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Powerful model for complex tasks',
    provider: 'anthropic',
    type: 'chat',
  },
];

export const CXDM_MODELS: ChatModel[] = [
  {
    id: '__REPLACE__CUSTOM_AI_MODEL',
    name: '__REPLACE__CUSTOM_AI_MODEL'.replaceAll('_', '-').split('-').map(([ch1, ...restCh]) => `${ch1.toUpperCase()}${restCh.join('')}`).join(' '),
    description: 'CX DM AI Agent',
    provider: 'cxdm',
    type: 'chat',
  },
];

// 모든 모델을 하드코딩된 배열로 정의
export const ALL_MODELS: ChatModel[] = [
  ...XAI_MODELS,
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...CXDM_MODELS,
];

// 챗 모델만 필터링
export const chatModels = ALL_MODELS.filter(model => model.type === 'chat');

// 추론 모델만 필터링
export const reasoningModels = ALL_MODELS.filter(model => model.type === 'reasoning');

// 기본 챗 모델 - 환경 변수에서 읽거나 첫 번째 사용 가능한 모델 사용
export const DEFAULT_CHAT_MODEL: string = (() => {
  // 서버 사이드에서만 환경 변수 접근
  if (typeof window === 'undefined' && process.env.DEFAULT_CHAT_MODEL) {
    return process.env.DEFAULT_CHAT_MODEL;
  }
  // 클라이언트 또는 환경 변수가 없을 때 기본값
  return 'gpt-3.5-turbo';
})();

// Function to get all available model IDs for entitlements
export function getAllAvailableModelIds(): string[] {
  return ALL_MODELS.map(model => model.id);
}

// 서버 사이드에서만 사용하는 함수들 (환경 변수 체크)
export function getAvailableModels(): ChatModel[] {
  const models: ChatModel[] = [];
  
  if (process.env.XAI_API_KEY) {
    models.push(...XAI_MODELS);
  }
  
  if (process.env.OPENAI_API_KEY) {
    models.push(...OPENAI_MODELS);
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    models.push(...ANTHROPIC_MODELS);
  }
  
  // CXDM 모델은 API 키가 필요 없음
  models.push(...CXDM_MODELS);
  
  return models;
}

export function getChatModels(): ChatModel[] {
  return getAvailableModels().filter(model => model.type === 'chat');
}

export function getReasoningModels(): ChatModel[] {
  return getAvailableModels().filter(model => model.type === 'reasoning');
}
