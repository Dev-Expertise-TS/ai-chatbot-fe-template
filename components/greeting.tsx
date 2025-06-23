import { motion } from 'framer-motion';
import Link from 'next/link';

export const Greeting = () => {
  return (
    <div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 px-8 size-full flex flex-col justify-end"
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
        className="text-2xl font-medium text-center font-serif"
      >
        무엇을 도와드릴까요?
      </motion.div>
      {/* <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
        className="text-sm text-center text-zinc-500"
      >
        <Link href="https://luxury-select.co.kr">Tourvis Select</Link> <span>AI Concierge</span>
      </motion.div> */}
    </div>
  );
};
