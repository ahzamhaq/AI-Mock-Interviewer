import React from 'react';
import { motion } from 'framer-motion';

const LoadingScreen = () => (
  <div className="min-h-screen bg-dark-900 flex items-center justify-center">
    <motion.div
      className="flex flex-col items-center gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative">
        <motion.div
          className="w-16 h-16 rounded-full border-4 border-primary-600/30 border-t-primary-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🎙️</div>
      </div>
      <p className="text-white/50 text-sm font-medium tracking-wide">Loading InterviewAI...</p>
    </motion.div>
  </div>
);

export default LoadingScreen;
