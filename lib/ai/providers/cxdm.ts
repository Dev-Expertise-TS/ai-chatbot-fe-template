import {
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1CallWarning,
  type LanguageModelV1FinishReason,
  type LanguageModelV1StreamPart,
  NoSuchModelError,
} from '@ai-sdk/provider';

// CXDM API 엔드포인트
const CUSTOM_API_ENDPOINT = process.env.CUSTOM_API_ENDPOINT || '';

// 디버깅을 위한 상세 로깅 함수
const DEBUG_MODE = process.env.CXDM_DEBUG === 'true';
function logDebug(label: string, data: any) {
  if (DEBUG_MODE) {
    console.log(`[CXDM Provider] ${label}:`, JSON.stringify(data, null, 2));
  }
}

// 환경변수 확인
if (DEBUG_MODE) {
  console.log('[CXDM Provider] API Endpoint:', CUSTOM_API_ENDPOINT);
}

// CXDM 모델 클래스
export class CXDMLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly provider = 'cxdm';
  readonly modelId: string;
  readonly defaultObjectGenerationMode = undefined;

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<{
    text: string;
    usage: { promptTokens: number; completionTokens: number };
    finishReason: LanguageModelV1FinishReason;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, any> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    console.log('[CXDM Provider] doGenerate called!');
    const { prompt: messages, abortSignal } = options;

    // chat_id 생성
    let chatId = generateUUID();

    // 시스템 메시지에서 INTERNAL_CHAT_ID 찾기 (있을 경우)
    const systemMessage = messages.find(
      (msg: any) =>
        msg.role === 'system' &&
        typeof msg.content === 'string' &&
        msg.content.includes('[INTERNAL_CHAT_ID:'),
    );

    if (systemMessage && typeof systemMessage.content === 'string') {
      const match = systemMessage.content.match(
        /\[INTERNAL_CHAT_ID:([^\]]+)\]/,
      );
      if (match) {
        chatId = match[1];
      }
    }

    // INTERNAL_CHAT_ID 메시지 제거
    const filteredMessages = messages.filter(
      (msg: any) =>
        !(
          msg.role === 'system' &&
          typeof msg.content === 'string' &&
          msg.content.includes('[INTERNAL_CHAT_ID:')
        ),
    );

    // 마지막 사용자 메시지만 추출
    const lastUserMessage = filteredMessages
      .slice()
      .reverse()
      .find((msg: any) => msg.role === 'user');

    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    // 텍스트 내용만 추출
    let messageText = '';
    if (typeof lastUserMessage.content === 'string') {
      messageText = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage.content)) {
      messageText = lastUserMessage.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(' ');
    }

    // CXDM API 요청
    const requestBody = {
      message: messageText,
      chat_id: chatId,
    };

    logDebug('doGenerate Request Body', requestBody);

    const response = await fetch(CUSTOM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`CXDM API error: ${response.statusText} - ${errorBody}`);
    }

    // SSE 스트림을 텍스트로 수집
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.replace(/\r$/, '');
          
          if (cleanLine.trim() === '') continue;
          if (cleanLine.startsWith(': ping')) continue;

          if (cleanLine.startsWith('data: ')) {
            const data = cleanLine.slice(6).replace(/\r$/, '');

            if (data === '[DONE]' || data.trim() === '[DONE]') {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.choices?.[0]?.delta?.content) {
                fullText += parsed.choices[0].delta.content;
              }
            } catch (e) {
              // 파싱 에러 무시
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: fullText,
      usage: { promptTokens: 0, completionTokens: 0 },
      finishReason: 'stop',
      rawCall: {
        rawPrompt: requestBody,
        rawSettings: {},
      },
    };
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    usage?: Promise<{ promptTokens: number; completionTokens: number }>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, any> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    console.log('[CXDM Provider] doStream called!');
    const { prompt: messages, abortSignal } = options;

    // chat_id 추출 - INTERNAL_CHAT_ID 마커에서 추출
    let chatId = generateUUID();

    // 시스템 메시지에서 INTERNAL_CHAT_ID 찾기
    const systemMessage = messages.find(
      (msg) =>
        msg.role === 'system' &&
        typeof msg.content === 'string' &&
        msg.content.includes('[INTERNAL_CHAT_ID:'),
    );

    if (systemMessage && typeof systemMessage.content === 'string') {
      const match = systemMessage.content.match(
        /\[INTERNAL_CHAT_ID:([^\]]+)\]/,
      );
      if (match) {
        chatId = match[1];
        logDebug('Extracted chatId from system message', chatId);
      }
    }

    // INTERNAL_CHAT_ID 메시지 제거 (API로 전송하지 않음)
    const filteredMessages = messages.filter(
      (msg) =>
        !(
          msg.role === 'system' &&
          typeof msg.content === 'string' &&
          msg.content.includes('[INTERNAL_CHAT_ID:')
        ),
    );

    logDebug('Stream Request Options', {
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1],
      chatId,
      filteredMessagesCount: filteredMessages.length,
      allMessages: messages,
    });

    // 마지막 사용자 메시지만 추출 (필터링된 메시지에서)
    const lastUserMessage = filteredMessages
      .slice()
      .reverse()
      .find((msg: any) => msg.role === 'user');

    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    // 텍스트 내용만 추출 (multipart content 처리)
    let messageText = '';
    if (typeof lastUserMessage.content === 'string') {
      messageText = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage.content)) {
      messageText = lastUserMessage.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(' ');
    }

    // CXDM API 요청 body
    const requestBody = {
      message: messageText,
      chat_id: chatId,
    };

    logDebug('Request Body', requestBody);

    // 직접 fetch 호출
    const response = await fetch(CUSTOM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal,
    });

    logDebug('Response Status', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logDebug('Error Response Body', errorBody);
      throw new Error(`CXDM API error: ${response.statusText} - ${errorBody}`);
    }

    // SSE 스트림 처리를 위한 TransformStream
    const { readable, writable } =
      new TransformStream<LanguageModelV1StreamPart>();
    const writer = writable.getWriter();

    // 응답 스트림 처리
    (async () => {
      const reader = response.body?.getReader();
      if (!reader) {
        writer.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            // 캐리지 리턴 제거
            const cleanLine = line.replace(/\r$/, '');
            
            if (cleanLine.trim() === '') continue;

            logDebug('SSE Line', cleanLine);

            // ping 메시지 처리 (주석 형태)
            if (cleanLine.startsWith(': ping')) {
              logDebug('Ping received', cleanLine);
              continue; // ping은 무시
            }

            if (cleanLine.startsWith('data: ')) {
              const data = cleanLine.slice(6).replace(/\r$/, '');

              if (data === '[DONE]' || data.trim() === '[DONE]') {
                logDebug('Stream Complete', { fullText });
                await writer.write({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                  },
                });
                return; // break 대신 return으로 변경
              }

              try {
                // OpenAI 형식으로 파싱 시도
                const parsed = JSON.parse(data);
                logDebug('Parsed SSE Data', parsed);

                // CXDM API 응답 처리
                if (parsed.choices?.[0]?.delta) {
                  const delta = parsed.choices[0].delta;
                  
                  // 1. Tool Call 처리
                  if (delta.tool_call) {
                    logDebug('Tool Call Detected', delta.tool_call);
                    
                    // Tool call 시작 또는 진행중
                    if (delta.tool_call.name && delta.tool_call.arguments) {
                      // send_task를 위한 타이틀 생성
                      let toolTitle = '';
                      if (delta.tool_call.name === 'send_task') {
                        const agentName = delta.tool_call.arguments.agent_name || '';
                        const task = delta.tool_call.arguments.task || '';
                        toolTitle = `${agentName.replace(/_/g, ' ')}에게 요청: ${task}`;
                      } else {
                        toolTitle = `${delta.tool_call.name} 실행`;
                      }
                      
                      // Tool call 표시를 위한 특별한 마커를 텍스트로 전송
                      await writer.write({
                        type: 'text-delta',
                        textDelta: `[TOOL_CALL_START]${toolTitle}[TOOL_CALL_END]\n\n`,
                      });
                    }
                    
                    // Tool call 결과 - 실제 결과는 이후 content로 스트리밍됨
                    if (delta.tool_call.result) {
                      const resultText = Array.isArray(delta.tool_call.result.result) 
                        ? delta.tool_call.result.result.join('\n')
                        : JSON.stringify(delta.tool_call.result);
                      
                      logDebug('Tool Result Preview', `${resultText.substring(0, 200)}...`);
                      // 결과는 이후 delta.content로 스트리밍되므로 여기서는 처리하지 않음
                    }
                    
                  }
                  
                  // 2. 일반 텍스트 콘텐츠 처리 (tool_call이 있어도 content가 있을 수 있음)
                  if (delta.content) {
                    const content = delta.content;
                    fullText += content;

                    await writer.write({
                      type: 'text-delta',
                      textDelta: content,
                    });
                  }
                }
                // 다른 형식일 경우를 위한 폴백
                else if (typeof parsed === 'string') {
                  fullText += parsed;
                  await writer.write({
                    type: 'text-delta',
                    textDelta: parsed,
                  });
                } else if (parsed.content) {
                  fullText += parsed.content;
                  await writer.write({
                    type: 'text-delta',
                    textDelta: parsed.content,
                  });
                } else if (parsed.text) {
                  fullText += parsed.text;
                  await writer.write({
                    type: 'text-delta',
                    textDelta: parsed.text,
                  });
                }
              } catch (e) {
                logDebug('SSE Parse Error', { data, error: e });
                // 파싱 실패 시 원본 데이터를 텍스트로 처리
                if (data && data !== '[DONE]' && !data.includes('[DONE]')) {
                  fullText += data;
                  await writer.write({
                    type: 'text-delta',
                    textDelta: data,
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        logDebug('Stream Error', error);
        try {
          await writer.write({
            type: 'error',
            error: error as Error,
          });
        } catch (writeError) {
          logDebug('Error writing error to stream', writeError);
        }
      } finally {
        try {
          writer.close();
        } catch (closeError) {
          logDebug('Stream already closed', closeError);
        }
      }
    })();

    return {
      stream: readable,
      rawCall: {
        rawPrompt: requestBody,
        rawSettings: {},
      },
    };
  }
}

// UUID 생성 함수
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 전역 chatId 저장소 (실제로는 더 나은 방식 필요)
let globalChatId: string | null = null;

export function setChatId(chatId: string) {
  globalChatId = chatId;
}

// 모델 ID에 대한 프로바이더 인스턴스 반환
export function getCXDMModel(modelId: string): LanguageModelV1 {
  console.log('[CXDM Provider] getCXDMModel called with:', modelId);
  logDebug('Getting CXDM Model', { modelId });

  if (modelId !== '__REPLACE__CUSTOM_AI_MODEL') {
    throw new NoSuchModelError({ modelId, modelType: 'languageModel' });
  }

  return new CXDMLanguageModelWithChatId(modelId);
}

// ChatId를 처리하는 래퍼 클래스
class CXDMLanguageModelWithChatId extends CXDMLanguageModel {
  async doStream(options: LanguageModelV1CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    usage?: Promise<{ promptTokens: number; completionTokens: number }>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, any> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
    console.log('[CXDM Provider] CXDMLanguageModelWithChatId.doStream called!');
    // globalChatId 사용
    const chatId = globalChatId || generateUUID();

    console.log('[CXDM Provider] globalChatId:', globalChatId);
    
    // 원래 doStream 호출하되, chatId를 주입
    const originalDoStream = super.doStream.bind(this);

    // prompt에 chatId 정보를 추가하는 방식으로 전달
    const modifiedOptions = {
      ...options,
      prompt: [
        {
          role: 'system' as const,
          content: `[INTERNAL_CHAT_ID:${chatId}]`,
        },
        ...(options.prompt || []),
      ],
    };

    console.log('[CXDM Provider] Calling super.doStream with modified options');
    return originalDoStream(modifiedOptions);
  }
}

// 디버깅 헬퍼: SSE 응답 스트림을 로깅하면서 전달
export function wrapStreamForLogging(stream: ReadableStream): ReadableStream {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (buffer) {
              logDebug('Final Buffer', buffer);
            }
            controller.close();
            break;
          }

          // 원본 데이터 전달
          controller.enqueue(value);

          // 로깅을 위한 디코딩
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              logDebug('Stream Line', line);
            }
          }
        }
      } catch (error) {
        logDebug('Stream Error', error);
        controller.error(error);
      }
    },
  });
}
