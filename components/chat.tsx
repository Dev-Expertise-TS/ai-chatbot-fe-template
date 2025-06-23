'use client';

import type { Attachment, UIMessage, Message } from 'ai';
import { useChat } from '@ai-sdk/react';
import { useEffect, useState, useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher, fetchWithErrorHandlers, generateUUID } from '@/lib/utils';
import { Artifact } from './artifact';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import type { VisibilityType } from './visibility-selector';
import { useArtifactSelector } from '@/hooks/use-artifact';
import { unstable_serialize } from 'swr/infinite';
import { getChatHistoryPaginationKey } from './sidebar-history';
import { toast } from './toast';
import type { Session } from 'next-auth';
import { useSearchParams } from 'next/navigation';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import { useAutoResume } from '@/hooks/use-auto-resume';
import { ChatSDKError } from '@/lib/errors';
import { transformCXDMMessages } from '@/lib/utils/cxdm-message-transformer';

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  session,
  autoResume,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  session: Session;
  autoResume: boolean;
}) {
  const { mutate } = useSWRConfig();

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    status,
    stop,
    reload,
    experimental_resume,
    data,
  } = useChat({
    id,
    initialMessages,
    experimental_throttle: 50,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    fetch: fetchWithErrorHandlers,
    experimental_prepareRequestBody: (body) => ({
      id,
      message: body.messages.at(-1),
      selectedChatModel: initialChatModel,
      selectedVisibilityType: visibilityType,
    }),
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        toast({
          type: 'error',
          description: error.message,
        });
      }
    },
  });

  const searchParams = useSearchParams();
  const query = searchParams.get('query');
  const hotel = searchParams.get('hotel');
  const hotelId = searchParams.get('id');

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);

  useEffect(() => {
    let messageContent = '';

    // 기존 query 파라미터가 있으면 우선 사용
    if (query) {
      messageContent = query;
    }
    // query가 없고 hotel과 id가 모두 있으면 pre-dialog 메시지 생성
    else if (hotel && hotelId) {
      messageContent = `'${decodeURIComponent(hotel)}' 관심이 있어요. 셀렉트에서 제공하는 혜택정보, 진행중인 이벤트/프로모션 정보와 함께 호텔에 대한 안내를 부탁해요.`;
    }

    if (messageContent && !hasAppendedQuery) {
      append({
        role: 'user',
        content: messageContent,
      });

      setHasAppendedQuery(true);
      window.history.replaceState({}, '', `/chat/${id}`);
    }
  }, [query, hotel, hotelId, append, hasAppendedQuery, id, mutate]);

  const { data: votes } = useSWR<Array<Vote>>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher,
  );

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  useAutoResume({
    autoResume,
    initialMessages,
    experimental_resume,
    data,
    setMessages,
  });

  // Message를 UIMessage로 안전하게 변환하는 함수
  const ensureUIMessage = (msg: Message): UIMessage => {
    if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
      return msg as UIMessage;
    }

    // parts가 없으면 content를 기반으로 생성
    return {
      ...msg,
      parts: msg.content ? [{ type: 'text' as const, text: msg.content }] : [],
    };
  };

  // CXDM 모델인 경우 메시지 변환 적용
  const transformedMessages = useMemo((): UIMessage[] => {
    // 먼저 모든 메시지를 UIMessage로 변환
    const uiMessages = messages.map(ensureUIMessage);

    if (initialChatModel === '__REPLACE__CUSTOM_AI_MODEL') {
      return transformCXDMMessages(uiMessages);
    }
    return uiMessages;
  }, [messages, initialChatModel]);

  return (
    <>
      <div
        className={`flex flex-col min-w-0 max-w-full bg-background ${messages.length ? 'h-dvh' : 'h-3/5'}`}
      >
        <ChatHeader
          chatId={id}
          selectedModelId={initialChatModel}
          selectedVisibilityType={initialVisibilityType}
          isReadonly={isReadonly}
          session={session}
        />

        <Messages
          chatId={id}
          status={status}
          votes={votes}
          messages={transformedMessages}
          setMessages={setMessages}
          reload={reload}
          isReadonly={isReadonly}
          isArtifactVisible={isArtifactVisible}
        />

        <form className="flex mx-0 md:mx-auto px-2 sm:px-3 bg-background md:pb-6 gap-2 w-full md:max-w-3xl">
          {!isReadonly && (
            <MultimodalInput
              chatId={id}
              input={input}
              setInput={setInput}
              handleSubmit={handleSubmit}
              status={status}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              setMessages={setMessages}
              append={append}
              selectedVisibilityType={visibilityType}
            />
          )}
        </form>
      </div>

      <Artifact
        chatId={id}
        input={input}
        setInput={setInput}
        handleSubmit={handleSubmit}
        status={status}
        stop={stop}
        attachments={attachments}
        setAttachments={setAttachments}
        append={append}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        votes={votes}
        isReadonly={isReadonly}
        selectedVisibilityType={visibilityType}
      />
    </>
  );
}
