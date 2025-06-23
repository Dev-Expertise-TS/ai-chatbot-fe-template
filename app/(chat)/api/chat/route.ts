import {
  appendClientMessage,
  appendResponseMessages,
  createDataStream,
  smoothStream,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { generateUUID, getTrailingMessageId } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { myProvider } from '@/lib/ai/providers';
import { setChatId } from '@/lib/ai/providers/cxdm';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { getAvailableModels } from '@/lib/ai/models';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import type { Chat } from '@/lib/db/schema';
import { differenceInSeconds } from 'date-fns';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
  if (!globalStreamContext) {
    // Redis URL이 있을 때만 resumable stream context 생성 시도
    if (process.env.REDIS_URL) {
      try {
        globalStreamContext = createResumableStreamContext({
          waitUntil: after,
        });
      } catch (error: any) {
        console.error('Failed to create resumable stream context:', error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const { id, message, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    // Validate that the selected model is available
    const availableModels = getAvailableModels();
    const availableModelIds = availableModels.map(m => m.id);
    
    // Handle loading/default model case
    let actualModelId = selectedChatModel;
    if (selectedChatModel === 'loading' || selectedChatModel === 'default') {
      actualModelId = availableModels[0]?.id || 'gpt-4o';
    }
    
    if (!availableModelIds.includes(actualModelId)) {
      console.error(`Invalid model selected: ${actualModelId}. Available models:`, availableModelIds);
      return new Response(
        JSON.stringify({ error: 'Selected model is not available' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      // 먼저 빈 제목으로 챗을 생성하여 즉시 응답 시작
      await saveChat({
        id,
        userId: session.user.id,
        title: '새 대화', // 임시 제목
        visibility: selectedVisibilityType,
      });

      // 제목 생성은 백그라운드에서 비동기로 처리
      after(async () => {
        try {
          console.log('[Title Generation] Starting title generation for chat:', id);
          console.log('[Title Generation] Message:', message.content);
          
          const title = await generateTitleFromUserMessage({
            message: {
              ...message,
              parts: message.parts || [{ type: 'text', text: message.content }],
            },
          });

          console.log('[Title Generation] Generated title:', title);

          // 생성된 제목으로 업데이트 (직접 DB 업데이트 수행)
          const { drizzle } = await import('drizzle-orm/postgres-js');
          const { eq } = await import('drizzle-orm');
          const postgres = (await import('postgres')).default;
          const { chat } = await import('@/lib/db/schema');
          
          const client = postgres(process.env.POSTGRES_URL!);
          const db = drizzle(client);
          
          const result = await db
            .update(chat)
            .set({ title })
            .where(eq(chat.id, id));
            
          console.log('[Title Generation] Update result:', result);
          await client.end();
          console.log('[Title Generation] Title update completed successfully');
        } catch (error) {
          console.error('[Title Generation] Failed to generate or update title:', error);
        }
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const previousMessages = await getMessagesByChatId({ id });

    const messages = appendClientMessage({
      // @ts-expect-error: todo add type conversion from DBMessage[] to UIMessage[]
      messages: previousMessages,
      message,
    });

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts || [{ type: 'text', text: message.content }],
          attachments: message.experimental_attachments ?? [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    // CXDM 모델인 경우 chatId 설정
    if (actualModelId === '__REPLACE__CUSTOM_AI_MODEL') {
      setChatId(id);
    }

    console.log('[Chat Route] Creating stream with model:', actualModelId);
    console.log('[Chat Route] Messages:', messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content.substring(0, 100) : 'non-string' })));

    const stream = createDataStream({
      execute: (dataStream) => {
        console.log('[Chat Route] Execute called, creating streamText');
        const languageModel = myProvider.languageModel(actualModelId);
        console.log('[Chat Route] Language model:', languageModel);
        console.log('[Chat Route] Language model constructor:', languageModel?.constructor?.name);
        const result = streamText({
          model: languageModel,
          system: systemPrompt({ selectedChatModel: actualModelId, requestHints }),
          messages,
          maxSteps: 5,
          experimental_activeTools:
            actualModelId === 'chat-model-reasoning' || actualModelId === 'o1' || actualModelId === 'o1-mini' || actualModelId === 'grok-3-mini-beta'
              ? []
              : [
                  'getWeather',
                  'createDocument',
                  'updateDocument',
                  'requestSuggestions',
                ],
          // experimental_transform: smoothStream({ chunking: 'word' }), // 빠른 응답을 위해 비활성화
          experimental_generateMessageId: generateUUID,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({
              session,
              dataStream,
            }),
          },
          onFinish: async ({ response }) => {
            if (session.user?.id) {
              try {
                const assistantId = getTrailingMessageId({
                  messages: response.messages.filter(
                    (message) => message.role === 'assistant',
                  ),
                });

                if (!assistantId) {
                  throw new Error('No assistant message found!');
                }

                const [, assistantMessage] = appendResponseMessages({
                  messages: [message],
                  responseMessages: response.messages,
                });

                await saveMessages({
                  messages: [
                    {
                      id: assistantId,
                      chatId: id,
                      role: assistantMessage.role,
                      parts: assistantMessage.parts,
                      attachments:
                        assistantMessage.experimental_attachments ?? [],
                      createdAt: new Date(),
                    },
                  ],
                });
              } catch (_) {
                console.error('Failed to save chat');
              }
            }
          },
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        });

        result.consumeStream();

        result.mergeIntoDataStream(dataStream, {
          sendReasoning: true,
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () => stream),
      );
    } else {
      return new Response(stream);
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    console.error('Unexpected error in chat route:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET(request: Request) {
  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get('chatId');

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createDataStream({
    execute: () => {},
  });

  const stream = await streamContext.resumableStream(
    recentStreamId,
    () => emptyDataStream,
  );

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return new Response(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return new Response(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return new Response(emptyDataStream, { status: 200 });
    }

    const restoredStream = createDataStream({
      execute: (buffer) => {
        buffer.writeData({
          type: 'append-message',
          message: JSON.stringify(mostRecentMessage),
        });
      },
    });

    return new Response(restoredStream, { status: 200 });
  }

  return new Response(stream, { status: 200 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
