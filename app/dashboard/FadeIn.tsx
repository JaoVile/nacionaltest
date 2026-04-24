'use client';

import { motion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, y = 10, className }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
