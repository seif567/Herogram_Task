import React from 'react';
import { motion } from 'framer-motion';

export default function Card({children}:{children:React.ReactNode}){
  return (
    <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-soft p-4">
      {children}
    </motion.div>
  );
}
