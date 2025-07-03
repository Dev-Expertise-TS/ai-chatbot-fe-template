'use client';

import type { UIMessage } from 'ai';
import cx from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { PencilEditIcon } from './icons';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { PreviewAttachment } from './preview-attachment';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn, sanitizeText } from '@/lib/utils';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import { ToolCallReasoning } from './tool-call-reasoning';
import { StatusMessageBox } from './status-message-box';
import type { UseChatHelpers } from '@ai-sdk/react';
import { AnimatedGradientIcon } from './animated-gradient-icon';
import logo from '../app/assistant_logo.png';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  reload,
  isReadonly,
  requiresScrollPadding,
}: {
  chatId: string;
  message: UIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers['setMessages'];
  reload: UseChatHelpers['reload'];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');

   // 메시지 파트들을 그룹화하는 함수
  const getGroupedParts = () => {
    const groupedParts: Array<{ type: string, parts: any[] }> = [];
    let currentGroup: { type: string, parts: any[] } | null = null;

    message.parts?.forEach((part) => {
      if (part.type === 'text' && message.role === 'assistant' && part.text.includes('<!--STATUS:')) {
        // 상태 메시지와 일반 텍스트를 분리
        const lines = part.text.split(/(?=<!--STATUS:)|(?<=-->)/);

        lines.forEach(line => {
          const statusMatch = line.match(/<!--STATUS:(call|result):(.+?)-->/);
          if (statusMatch) {
            // 상태 메시지
            if (currentGroup?.type === 'status') {
              currentGroup.parts.push({
                state: statusMatch[1],
                message: statusMatch[2]
              });
            } else {
              if (currentGroup) groupedParts.push(currentGroup);
              currentGroup = {
                type: 'status',
                parts: [{
                  state: statusMatch[1],
                  message: statusMatch[2]
                }]
              };
            }
          } else if (line.trim()) {
            // 일반 텍스트
            const cleanText = line.replace(/<!--STATUS:(call|result):(.+?)-->/g, '').trim();
            if (cleanText) {
              if (currentGroup?.type === 'text') {
                currentGroup.parts.push({ type: 'text', text: cleanText });
              } else {
                if (currentGroup) groupedParts.push(currentGroup);
                currentGroup = { type: 'text', parts: [{ type: 'text', text: cleanText }] };
              }
            }
          }
        });
      } else if (part.type === 'text') {
        // 일반 텍스트 파트
        if (currentGroup?.type === 'text') {
          currentGroup.parts.push(part);
        } else {
          if (currentGroup) groupedParts.push(currentGroup);
          currentGroup = { type: 'text', parts: [part] };
        }
      } else {
        // 다른 타입의 파트
        if (currentGroup) {
          groupedParts.push(currentGroup);
          currentGroup = null;
        }
        groupedParts.push({ type: part.type, parts: [part] });
      }
    });

    if (currentGroup) groupedParts.push(currentGroup);
    return groupedParts;
  };

  const groupedParts = getGroupedParts();

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-full md:max-w-3xl px-3 sm:px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'flex gap-4 w-full max-w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl',
            {
              'w-full': mode === 'edit',
              'group-data-[role=user]/message:w-fit': mode !== 'edit',
            },
          )}
        >
          {message.role === 'assistant' && (
            <div className="size-8 items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background overflow-hidden hidden sm:flex">
              <div
                className="size-7 bg-contain"
                style={{
                  backgroundImage: `url(${logo.src})`,
                }}
              />
            </div>
          )}

          <div
            className={cn(
              'flex flex-col gap-4 w-full overflow-hidden max-w-full',
            )}
          >
            {message.experimental_attachments && message.experimental_attachments.length > 0 && (
              <div
                data-testid={`message-attachments`}
                className="flex flex-row justify-end gap-2"
              >
                {message.experimental_attachments.map((attachment) => (
                  <PreviewAttachment
                    key={attachment.url}
                    attachment={attachment}
                  />
                ))}
              </div>
            )}
 {groupedParts.map((group, groupIndex) => {
              const key = `message-${message.id}-group-${groupIndex}`;

              if (group.type === 'status') {
                return <StatusMessageBox key={key} messages={group.parts} />;
              }

              if (group.type === 'text') {
                return group.parts.map((part, partIndex) => {
                  const partKey = `${key}-part-${partIndex}`;

                  if (mode === 'view') {
                    return (
                      <div key={partKey} className="flex flex-row gap-2 items-start">
                        {message.role === 'user' && !isReadonly && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                data-testid="message-edit-button"
                                variant="ghost"
                                className="px-2 h-fit rounded-full text-muted-foreground opacity-0 group-hover/message:opacity-100"
                                onClick={() => {
                                  setMode('edit');
                                }}
                              >
                                <PencilEditIcon />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit message</TooltipContent>
                          </Tooltip>
                        )}

                        <motion.div
                          data-testid="message-content"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5, ease: 'easeOut', delay: groupIndex * 0.2 }}
                          className={cn(
                            'flex flex-col gap-4 overflow-hidden max-w-full',
                            {
                              'bg-primary text-primary-foreground px-3 py-2 rounded-2xl':
                                message.role === 'user',
                            },
                          )}
                        >
                          <Markdown>{sanitizeText(part.text)}</Markdown>
                        </motion.div>
                      </div>
                    );
                  }

                  if (mode === 'edit') {
                    return (
                      <div key={partKey} className="flex flex-row gap-2 items-start">
                        <div className="size-8" />
                        <MessageEditor
                          key={message.id}
                          message={message}
                          setMode={setMode}
                          setMessages={setMessages}
                          reload={reload}
                        />
                      </div>
                    );
                  }
                });
              }

              if (group.type === 'reasoning') {
                const part = group.parts[0];
                if (part.reasoning?.includes('🔄')) {
                  return (
                    <ToolCallReasoning
                      key={key}
                      isLoading={isLoading}
                      reasoning={part.reasoning}
                    />
                  );
                }

                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (group.type === 'tool-invocation') {
                const part = group.parts[0];
                const { toolInvocation } = part;
                const { toolName, toolCallId, state } = toolInvocation;

                if (state === 'call') {
                  const { args } = toolInvocation;

                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview isReadonly={isReadonly} args={args} />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'send_task' ? (
                        <DocumentToolCall
                          type="create"
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : null}
                    </div>
                  );
                }

                if (state === 'result') {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolResult
                          type="update"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'send_task' ? (
                        <DocumentToolResult
                          type="create"
                          result={result}
                          isReadonly={isReadonly}
                        />
                      ) : (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      )}
                    </div>
                  );
                }
              }

              return null;
            })}

            {!isReadonly && (
              <MessageActions
                key={`action-${message.id}`}
                chatId={chatId}
                message={message}
                vote={vote}
                isLoading={isLoading}
              />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (prevProps.message.content !== nextProps.message.content) return false;
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding)
      return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;

    return true;
  },
);

export const ThinkingMessage = () => {
  const role = 'assistant';

  return (
    <motion.div
      data-testid="message-assistant-loading"
      className="w-full mx-auto max-w-3xl px-4 group/message min-h-96"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 0.5 } }}
      data-role={role}
    >
      <div
        className={cx(
          'flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-2xl',
          {
            'group-data-[role=user]/message:bg-muted': true,
          },
        )}
      >
        <div className="hidden sm:flex size-8 items-center justify-center shrink-0">
        </div>

        <div className="flex flex-row gap-3 w-full items-center">
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <AnimatedGradientIcon /> 
          </div>
          <span className="loading-gradient text-sm font-mono opacity-80">처리중...</span>
        </div>
      </div>
    </motion.div>
  );
};
