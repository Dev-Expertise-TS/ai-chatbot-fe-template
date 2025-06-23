'use client';

import { useState, useEffect } from 'react';
import { ChevronDownIcon, LoaderIcon } from './icons';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle } from 'lucide-react';

interface ToolCallReasoningProps {
  isLoading: boolean;
  reasoning: string;
}

export function ToolCallReasoning({
  isLoading,
  reasoning,
}: ToolCallReasoningProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // tool call 정보 파싱
  const match = reasoning.match(/🔄 (.+?)에게 요청: (.+)/);
  const agentName = match?.[1] || 'Agent';
  const task = match?.[2] || reasoning;

  // 로딩이 끝나면 자동으로 접기
  useEffect(() => {
    if (!isLoading) {
      setIsExpanded(false);
    }
  }, [isLoading]);

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
    <div className="flex flex-col bg-muted/50 rounded-lg p-3 my-2 text-sm border gap-2 text-foreground/70">
      {isLoading ? (
        <div className="flex flex-row gap-2 items-center">
          <div className="animate-spin">
            <LoaderIcon />
          </div>
          <div className="font-medium font-mono">
            AI 컨시어지가 답변을 준비하고 있습니다:
          </div>
        </div>
      ) : (
        <div className="flex flex-row gap-2 items-center justify-between">
          <div className="flex flex-row items-center justify-center gap-2">
            <CheckCircle className="text-muted-foreground" size={16} />
            <div className="font-medium font-mono">
              AI 컨시어지가 작업을 마쳤습니다!
            </div>
          </div>
          <button
            data-testid="tool-call-reasoning-toggle"
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
        {isExpanded && (
          <motion.div
            data-testid="tool-call-reasoning-content"
            key="content"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className="text-sm text-foreground/60 rounded-lg border border-dashed bg-background/30 border-black/20 dark:border-white/20"
          >
            <q className="px-4 py-2 inline-block italic">{task}</q>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
