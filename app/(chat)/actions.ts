'use server';

import { generateText, type UIMessage } from 'ai';
import { cookies } from 'next/headers';
import {
  deleteMessagesByChatIdAfterTimestamp,
  getMessageById,
  updateChatVisiblityById,
} from '@/lib/db/queries';
import type { VisibilityType } from '@/components/visibility-selector';
import { myProvider } from '@/lib/ai/providers';

export async function saveChatModelAsCookie(model: string) {
  // Don't save cookie if model selector is hidden
  if (process.env.NEXT_PUBLIC_HIDE_MODEL_SELECTOR === 'true') {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set('chat-model', model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  // Get the title generation model from environment variable
  const titleModel =
    process.env.TITLE_GENERATION_MODEL ||
    (() => {
      // Fallback to first available chat model
      const { getAvailableModels } = require('@/lib/ai/models');
      const availableModels = getAvailableModels();
      const firstChatModel = availableModels.find(
        (m: any) => m.type === 'chat',
      );
      return firstChatModel?.id || 'gpt-3.5-turbo';
    })();

  console.log('[Title Generation] Using model:', titleModel);

  const { text: title } = await generateText({
    model: myProvider.languageModel(titleModel),
    system: `You are a title generator. Generate a concise title for a chat conversation based on the user's first message.
Rules:
- 절대로 제목을 따옴표, 쌍따옴표 등으로 엮지 마라!
- Maximum 80 characters
- Summarize the main topic
- No quotes, colons, or special characters
- Be specific but concise
- Use the language of the user's message`,
    prompt: `Generate a short title for this user message: ${message.content || JSON.stringify(message)}`,
  });

  // Ensure title is not too long (fallback trimming)
  const cleanTitle = title.trim().substring(0, 80);
  console.log('[Title Generation] Final title:', cleanTitle);

  return cleanTitle;
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const [message] = await getMessageById({ id });

  await deleteMessagesByChatIdAfterTimestamp({
    chatId: message.chatId,
    timestamp: message.createdAt,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  await updateChatVisiblityById({ chatId, visibility });
}
