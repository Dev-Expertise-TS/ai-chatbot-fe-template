import type { UIMessage } from 'ai';

type UIPart = UIMessage['parts'][number];

/**
 * CXDM 프로바이더의 텍스트 메시지에서 tool call 마커를 감지하고
 * reasoning 파트로 변환합니다.
 */
export function transformCXDMMessage(message: UIMessage): UIMessage {
  // assistant 메시지가 아니면 그대로 반환
  if (message.role !== 'assistant') {
    return message;
  }

  const transformedParts: UIPart[] = [];
  
  for (const part of message.parts) {
    if (part.type === 'text' && part.text) {
      // Tool call 마커 패턴 검색
      const toolCallPattern = /\[TOOL_CALL_START\](.+?)\[TOOL_CALL_END\]\n\n/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      
      while ((match = toolCallPattern.exec(part.text)) !== null) {
        // 매치 이전 텍스트 추가
        if (match.index > lastIndex) {
          const beforeText = part.text.substring(lastIndex, match.index);
          if (beforeText.trim()) {
            transformedParts.push({
              type: 'text',
              text: beforeText
            });
          }
        }
        
        // reasoning 파트 생성
        const toolTitle = match[1];
        
        // Tool call을 reasoning으로 표시
        transformedParts.push({
          type: 'reasoning',
          reasoning: `🔄 ${toolTitle}`,
          details: []
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // 매치되지 않은 나머지 텍스트 추가
      if (lastIndex < part.text.length) {
        const remainingText = part.text.substring(lastIndex);
        if (remainingText.trim()) {
          transformedParts.push({
            type: 'text',
            text: remainingText
          });
        }
      }
    } else {
      // 다른 타입의 파트는 그대로 유지
      transformedParts.push(part);
    }
  }
  
  return {
    ...message,
    parts: transformedParts
  };
}

/**
 * 메시지 배열을 변환합니다.
 */
export function transformCXDMMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map(transformCXDMMessage);
}