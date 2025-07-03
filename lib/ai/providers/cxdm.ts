import {
  type LanguageModelV1,
  type LanguageModelV1CallOptions,
  type LanguageModelV1CallWarning,
  type LanguageModelV1FinishReason,
  type LanguageModelV1StreamPart,
  NoSuchModelError,
} from '@ai-sdk/provider';
import * as fs from 'node:fs';
import * as path from 'node:path';

// CXDM API 엔드포인트
const CXDM_API_ENDPOINT = process.env.CXDM_API_ENDPOINT || '';

// 디버깅을 위한 상세 로깅 함수
const DEBUG_MODE = process.env.CXDM_DEBUG === 'true';
function logDebug(label: string, data: any) {
  if (DEBUG_MODE) {
    // 디버깅 모드에서도 과도한 로깅은 제한
    if (label !== 'SSE Line' && label !== 'Parsed SSE Data') {
      console.log(`[CXDM Provider] ${label}:`, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    }
  }
}

// Partner Agent 메시지 인터페이스
export interface PartnerAgentMessage {
  nodeId: string;
  content: string;
  isStreaming: boolean;
}

// 커스텀 스트림 파트 타입
export type CXDMStreamPart = LanguageModelV1StreamPart | {
  type: 'partner-agent-message';
  partnerAgent: PartnerAgentMessage;
};

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
    throw new Error('doGenerate not implemented for CXDM');
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>;
    usage?: Promise<{ promptTokens: number; completionTokens: number }>;
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, any> };
    warnings?: LanguageModelV1CallWarning[];
  }> {
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

    // JSON-RPC 요청 body
    const requestBody = {
      id: generateUUID(),
      jsonrpc: '2.0',
      method: 'message/stream',
      params: {
        message: {
          messageId: generateUUID(),
          role: 'user',
          parts: [
            {
              kind: 'text',
              text: messageText,
            },
          ],
        },
        chat_id: chatId,
      },
    };

    logDebug('Request Body', requestBody);

    // 직접 fetch 호출
    const response = await fetch(CXDM_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
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
    const { readable, writable } = new TransformStream<LanguageModelV1StreamPart>();
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
      
      // 토큰 스트림 타이밍 제어를 위한 변수
      let lastWriteTime = Date.now();
      const MIN_WRITE_INTERVAL = 16; // 60fps에 맞춰 16ms
      
      // 로그 파일 설정
      const logDir = path.join(process.cwd(), 'logs');
      const logFile = path.join(logDir, `cxdm-stream-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
      
      // 로그 디렉토리 생성
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      // 로그 파일에 헤더 작성
      fs.writeFileSync(logFile, `CXDM Stream Log - ${new Date().toISOString()}\n`);
      fs.appendFileSync(logFile, `Chat ID: ${chatId}\n`);
      fs.appendFileSync(logFile, `Request: ${JSON.stringify(requestBody, null, 2)}\n`);
      fs.appendFileSync(logFile, `${'='.repeat(80)}\n\n`);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r\n\r\n|\n\n/);
          buffer = lines.pop() || '';

          for (const line of lines) {
            // 캐리지 리턴 제거 (백슬래시 처리는 하지 않음)
            // console.log('line: ', line);
            const cleanLine = line; // 원본 그대로 사용
            
            if (cleanLine.trim() === '') continue;

            logDebug('SSE Line', cleanLine);

            // ping 메시지 처리 (주석 형태)
            if (cleanLine.startsWith(': ping')) {
              logDebug('Ping received', cleanLine);
              continue; // ping은 무시
            }

            if (cleanLine.startsWith('data: ')) {
              const data = cleanLine.slice(6);
              
              // 모든 SSE 데이터를 로그 파일에 기록
              fs.appendFileSync(logFile, `[${new Date().toISOString()}] SSE Data: ${data}\n`);

              if (data === '[DONE]' || data.trim() === '[DONE]') {
                logDebug('Stream Complete', { fullText });
                fs.appendFileSync(logFile, '\n=== STREAM COMPLETE ===\n');
                
                await writer.write({
                  type: 'finish',
                  finishReason: 'stop',
                  usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                  },
                });
                
                // console.log(`[CXDM] Stream log saved to: ${logFile}`);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                // Partner Agent 메시지인 경우 상세 로깅
                if (parsed.jsonrpc === '2.0' && parsed.result?.kind === 'artifact-update') {
                  const metadata = parsed.result.artifact?.metadata || {};
                  if (metadata.langgraph_node && metadata.langgraph_node !== 'agent' && metadata.langgraph_node !== 'final') {
                    // console.log(`[CXDM] Partner Agent Message from ${metadata.langgraph_node}:`, parsed.result.artifact);
                    
                    // Partner Agent 메시지 상세 로깅
                    fs.appendFileSync(logFile, `\n--- PARTNER AGENT MESSAGE (${metadata.langgraph_node}) ---\n`);
                    fs.appendFileSync(logFile, `${JSON.stringify(parsed.result.artifact, null, 2)}\n`);
                    fs.appendFileSync(logFile, '--- END PARTNER AGENT MESSAGE ---\n\n');
                  }
                }
                logDebug('Parsed SSE Data', parsed);

                // JSON-RPC 응답 처리
                if (parsed.jsonrpc === '2.0' && parsed.result) {
                  const result = parsed.result;
                  
                  // artifact-update 형식 처리
                  if (result.kind === 'artifact-update' && result.artifact) {
                    const artifact = result.artifact;
                    const metadata = artifact.metadata || {};
                    const langgraphNode = metadata.langgraph_node;

                    // 전체 스트림 완료 체크
                    if (artifact.name === 'conversion_result') {
                      logDebug('Conversion Result - Stream Complete', artifact);
                      continue;
                    }

                    // 메시지 내용 추출
                    let messageContent = '';
                    if (artifact.parts && Array.isArray(artifact.parts)) {
                      for (const part of artifact.parts) {
                        if (part.kind === 'text' && part.text) {
                          messageContent += part.text;
                        }
                      }
                    }

                    // 빈 메시지는 무시
                    if (!messageContent || messageContent.trim() === '') {
                      continue;
                    }
                    
                    // console.log('[CXDM] Processing message:', messageContent);
                    
                    // 타이밍 제어
                    const now = Date.now();
                    const timeSinceLastWrite = now - lastWriteTime;
                    
                    if (timeSinceLastWrite < MIN_WRITE_INTERVAL) {
                      await new Promise(resolve => setTimeout(resolve, MIN_WRITE_INTERVAL - timeSinceLastWrite));
                    }
                    
                    // 상태 메시지 패턴 확인
                    const statusPatterns = [
                      { pattern: /🔍.*중\.\./, state: 'call' },
                      { pattern: /✅.*완료!/, state: 'result' },
                      { pattern: /⏳.*대기/, state: 'call' },
                      { pattern: /🔄.*진행/, state: 'call' },
                      { pattern: /📊.*분석/, state: 'call' },
                      { pattern: /💡.*생성/, state: 'call' }
                    ];
                    
                    let isStatusMessage = false;
                    let toolState = '';
                    
                    for (const { pattern, state } of statusPatterns) {
                      if (pattern.test(messageContent)) {
                        isStatusMessage = true;
                        toolState = state;
                        break;
                      }
                    }
                    
                    // 모든 메시지를 그대로 전송 (마커 포함)
                    if (isStatusMessage) {
                      const statusMarker = `<!--STATUS:${toolState}:${messageContent}-->`;
                      await writer.write({
                        type: 'text-delta',
                        textDelta: statusMarker,
                      });
                    } else {
                      fullText += messageContent;
                      await writer.write({
                        type: 'text-delta',
                        textDelta: messageContent,
                      });
                    }
                    
                    lastWriteTime = Date.now();
                  }
                  
                  // 스트림 완료 처리
                  else if (result.kind === 'status-update' && result.status?.state === 'completed') {
                    logDebug('Stream completed via status-update', result);
                    await writer.write({
                      type: 'finish',
                      finishReason: 'stop',
                      usage: {
                        promptTokens: 0,
                        completionTokens: 0,
                      },
                    });
                    return;
                  }
                }
              } catch (e) {
                logDebug('SSE Parse Error', { data, error: e });
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

// 전역 chatId 저장소
let globalChatId: string | null = null;

export function setChatId(chatId: string) {
  globalChatId = chatId;
}

// 기본 CXDM 모델 ID (환경 변수에서 가져오기)
const DEFAULT_CXDM_MODEL = process.env.DEFAULT_CHAT_MODEL || 'cxdm-1.1-concierge';

// 모델 ID에 대한 프로바이더 인스턴스 반환
export function getCXDMModel(modelId: string): LanguageModelV1 {
  logDebug('Getting CXDM Model', { modelId });

  // CXDM 프로바이더의 모델인지 확인 (환경 변수 값과 비교)
  if (modelId !== DEFAULT_CXDM_MODEL) {
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
    // globalChatId 사용
    const chatId = globalChatId || generateUUID();
    
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

    return originalDoStream(modifiedOptions);
  }
}