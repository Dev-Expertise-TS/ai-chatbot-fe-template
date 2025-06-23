import type { Message } from 'ai';
import { useSWRConfig } from 'swr';
import { useCopyToClipboard } from 'usehooks-ts';

import type { Vote } from '@/lib/db/schema';

import { CopyIcon, ThumbDownIcon, ThumbUpIcon } from './icons';
import { Button } from './ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { memo } from 'react';
import equal from 'fast-deep-equal';
import { toast } from 'sonner';

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
}: {
  chatId: string;
  message: Message;
  vote: Vote | undefined;
  isLoading: boolean;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const hideVoteButtons = process.env.NEXT_PUBLIC_HIDE_VOTE_BUTTONS === 'true';

  if (isLoading) return null;
  if (message.role === 'user') return null;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-row gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="py-1 px-2 h-fit text-muted-foreground"
              variant="outline"
              onClick={async () => {
                const textFromParts = message.parts
                  ?.filter((part) => part.type === 'text')
                  .map((part) => part.text)
                  .join('\n')
                  .trim();

                if (!textFromParts) {
                  toast.error('복사할 텍스트가 없습니다!');
                  return;
                }

                await copyToClipboard(textFromParts);
                toast.success('클립보드로 복사 했습니다!');
              }}
            >
              <CopyIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>복사</TooltipContent>
        </Tooltip>

        {!hideVoteButtons && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="message-upvote"
                  className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
                  disabled={vote?.isUpvoted}
                  variant="outline"
                  onClick={async () => {
                    const upvote = fetch('/api/vote', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        chatId,
                        messageId: message.id,
                        type: 'up',
                      }),
                    });

                    toast.promise(upvote, {
                      loading: '좋은 응답으로 평가중...',
                      success: () => {
                        mutate<Array<Vote>>(
                          `/api/vote?chatId=${chatId}`,
                          (currentVotes) => {
                            if (!currentVotes) return [];

                            const votesWithoutCurrent = currentVotes.filter(
                              (vote) => vote.messageId !== message.id,
                            );

                            return [
                              ...votesWithoutCurrent,
                              {
                                chatId,
                                messageId: message.id,
                                isUpvoted: true,
                              },
                            ];
                          },
                          { revalidate: false },
                        );

                        return '좋은 응답으로 평가 했습니다!';
                      },
                      error: '좋은 응답 평가에 실패 했습니다.',
                    });
                  }}
                >
                  <ThumbUpIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>좋은 응답으로 평가하기</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid="message-downvote"
                  className="py-1 px-2 h-fit text-muted-foreground !pointer-events-auto"
                  variant="outline"
                  disabled={vote && !vote.isUpvoted}
                  onClick={async () => {
                    const downvote = fetch('/api/vote', {
                      method: 'PATCH',
                      body: JSON.stringify({
                        chatId,
                        messageId: message.id,
                        type: 'down',
                      }),
                    });

                    toast.promise(downvote, {
                      loading: '실망스런 응답으로 평가중...',
                      success: () => {
                        mutate<Array<Vote>>(
                          `/api/vote?chatId=${chatId}`,
                          (currentVotes) => {
                            if (!currentVotes) return [];

                            const votesWithoutCurrent = currentVotes.filter(
                              (vote) => vote.messageId !== message.id,
                            );

                            return [
                              ...votesWithoutCurrent,
                              {
                                chatId,
                                messageId: message.id,
                                isUpvoted: false,
                              },
                            ];
                          },
                          { revalidate: false },
                        );

                        return '실망스런 응답으로 평가 했습니다!';
                      },
                      error: '실망스런 응답 평가에 실패 했습니다.',
                    });
                  }}
                >
                  <ThumbDownIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>실망스런 응답으로 평가하기</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (prevProps.isLoading !== nextProps.isLoading) return false;

    return true;
  },
);
