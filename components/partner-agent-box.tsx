'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { ChevronDownIcon } from './icons';
import { cn } from '@/lib/utils';
import { Markdown } from './markdown';

interface PartnerAgentBoxProps {
  nodeId: string;
  content: string;
  statusMessage?: string;
  isStreaming: boolean;
  className?: string;
  animationDelay?: number;
}

export function PartnerAgentBox({
  nodeId,
  content,
  statusMessage,
  isStreaming,
  className,
  animationDelay = 0,
}: PartnerAgentBoxProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const getNodeDisplayName = (node: string) => {
    const displayNames: Record<string, string> = {
      a2a: '🔍 호텔 검색 에이전트',
      booking: '📝 예약 관리 에이전트',
      recommendation: '💡 추천 에이전트',
      information: 'ℹ️ 정보 제공 에이전트',
    };
    return displayNames[node] || `🤖 ${node} 에이전트`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: animationDelay }}
      className={cn(
        'border rounded-2xl bg-muted/50  transition-all',
        className
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/70 transition-colors"
      >
        <span className="text-sm font-medium">
          {getNodeDisplayName(nodeId)}
        </span>
        <div className="flex items-center gap-2">
          {isStreaming && statusMessage && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {statusMessage}
            </span>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDownIcon size={16} />
          </motion.div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className=""
          >
            <div
              data-testid="message-content"
              className="p-3 pt-0 text-sm"
              style={{ wordBreak: 'break-word' }}
            >
              {content ? (
                <Markdown>{content}</Markdown>
              ) : (
                <span className="italic text-muted-foreground">메시지를 기다리는 중...</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}