'use client';

import { motion } from 'framer-motion';

interface Props {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400
                      dark:bg-deep-50 dark:text-ivory-500
                      flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-serif text-2xl tracking-tight text-slate-900 dark:text-ivory-100">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-ivory-400 leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
