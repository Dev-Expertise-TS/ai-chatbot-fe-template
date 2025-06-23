import { cookies } from 'next/headers';

import { Chat } from '@/components/chat';
import { getDefaultChatModel } from '@/lib/ai/default-model';
import { getDefaultChatVisibility } from '@/lib/ai/default-visibility';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { auth } from '../(auth)/auth';
import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<{
    hotel?: string;
    id?: string;
    query?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth();

  if (!session) {
    redirect('/api/auth/guest');
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('chat-model');
  const defaultModel = getDefaultChatModel();
  const defaultVisibility = getDefaultChatVisibility();
  
  // Check if model selector is hidden
  const isModelSelectorHidden = process.env.NEXT_PUBLIC_HIDE_MODEL_SELECTOR === 'true';
  
  // If model selector is hidden, always use the default model
  // Otherwise, use cookie value if available
  const selectedModel = isModelSelectorHidden 
    ? defaultModel 
    : (modelIdFromCookie?.value || defaultModel);

  // Pre-dialog 기능: hotel과 id 파라미터가 모두 있을 때 자동 메시지 생성
  const params = await searchParams;
  const hotel = params.hotel;
  const hotelId = params.id;
  
  // hotel과 id 파라미터가 모두 있을 때 Chat 컴포넌트로 직접 전달
  // Chat 컴포넌트가 searchParams를 읽어서 처리하도록 함

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        initialChatModel={selectedModel}
        initialVisibilityType={defaultVisibility}
        isReadonly={false}
        session={session}
        autoResume={false}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
