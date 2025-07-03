'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDownIcon, LoaderIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

interface StatusMessageBoxProps {
  messages: Array<{
    state: 'call' | 'result';
    message: string;
  }>;
}

export function StatusMessageBox({ messages }: StatusMessageBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 마지막 메시지
  const lastMessage = messages[messages.length - 1];
  const isLoading = lastMessage?.state === 'call';
  
  // 히스토리 메시지들을 메모이제이션
  const historyMessages = useMemo(() => {
    return messages.slice(0, -1);
  }, [messages]);
  
  // 로딩이 끝나면 자동으로 접기
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const timer = setTimeout(() => {
        setIsExpanded(isLoading);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, messages.length]);

  if (messages.length === 0) return null;

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
    },
  };


  return (
    <div className="flex flex-col bg-muted/50 rounded-2xl p-3 text-sm border gap-2 text-foreground/70">
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="animate-spin">
            <LoaderIcon />
          </div>
          <div className="font-medium font-mono">
            {lastMessage.message.replace('_', ' ')}
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-2 items-center justify-between">
          <div className="flex flex-row items-center justify-center gap-2">
            <CheckCircle className="text-muted-foreground" size={16} />
            <div className="font-medium font-mono">
              {lastMessage.message.replace('_', ' ')}
            </div>
          </div>
          <button
            data-testid="status-message-toggle"
            type="button"
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDownIcon />
            </motion.div>
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isExpanded && messages.length > 1 && (
          <motion.div
            data-testid="status-message-history"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="text-sm text-foreground/60 rounded-2xl border border-dashed bg-background/30 border-black/20 dark:border-white/20"
          >
            <div className="px-4 py-2">
              {historyMessages.map((msg, idx) => (
                <div key={`history-${idx}`} className="py-1">
                  {msg.message.replace('_', ' ')}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}