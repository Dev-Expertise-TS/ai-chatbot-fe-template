import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type LanguageModel,
} from 'ai';
import { xai } from '@ai-sdk/xai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { getAvailableModels } from './models';
import { getCXDMModel } from './providers/cxdm';

function createLanguageModels() {
  const models: Record<string, LanguageModel> = {};
  const availableModels = getAvailableModels();

  for (const model of availableModels) {
    if (model.provider === 'xai' && process.env.XAI_API_KEY) {
      if (model.type === 'reasoning') {
        models[model.id] = wrapLanguageModel({
          model: xai(model.id),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        });
      } else {
        models[model.id] = xai(model.id);
      }
    } else if (model.provider === 'openai' && process.env.OPENAI_API_KEY) {
      if (model.type === 'reasoning') {
        models[model.id] = wrapLanguageModel({
          model: openai(model.id),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        });
      } else {
        models[model.id] = openai(model.id);
      }
    } else if (model.provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
      models[model.id] = anthropic(model.id);
    } else if (model.provider === 'cxdm') {
      // CXDM 프로바이더는 API 키가 필요 없음
      models[model.id] = getCXDMModel(model.id);
    }
  }

  // Add legacy model aliases for backward compatibility
  const defaultChatModel = availableModels.find(m => m.type === 'chat');
  const defaultReasoningModel = availableModels.find(m => m.type === 'reasoning');
  
  if (defaultChatModel) {
    models['chat-model'] = models[defaultChatModel.id];
    models['title-model'] = models[defaultChatModel.id];
    models['artifact-model'] = models[defaultChatModel.id];
  }
  
  if (defaultReasoningModel) {
    models['chat-model-reasoning'] = models[defaultReasoningModel.id];
  }

  return models;
}

function createImageModels() {
  const models: Record<string, any> = {};

  if (process.env.XAI_API_KEY) {
    models['grok-2-image'] = xai.image('grok-2-image');
    models['small-model'] = xai.image('grok-2-image'); // legacy alias
  }

  if (process.env.OPENAI_API_KEY) {
    models['dall-e-3'] = openai.image('dall-e-3');
  }

  return models;
}

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: createLanguageModels(),
      imageModels: createImageModels(),
    });
