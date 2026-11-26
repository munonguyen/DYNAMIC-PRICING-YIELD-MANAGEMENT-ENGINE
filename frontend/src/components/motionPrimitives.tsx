import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, useSpring } from 'framer-motion';

/**
 * Refined architectural deceleration curve (velvety ease-out, zero bounce).
 */
export const EXPO_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  yOffset?: number;
  direction?: 'up' | 'left' | 'right';
}

export const ScrollReveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  className = '',
  yOffset = 24,
  direction = 'up',
}) => {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const initialX = direction === 'left' ? -22 : direction === 'right' ? 22 : 0;
  const initialY = direction === 'up' ? yOffset : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: initialX, y: initialY }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 'some', margin: '0px 0px -56px 0px' }}
      transition={{ duration: 0.68, delay, ease: EXPO_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

interface AnimatedVndProps {
  value: number;
  className?: string;
}

export const AnimatedVnd: React.FC<AnimatedVndProps> = ({ value, className = '' }) => {
  const prefersReduced = useReducedMotion();
  const spring = useSpring(value, { stiffness: 150, damping: 25, mass: 0.8 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    spring.set(value);
    const unsub = spring.on('change', (latest) => {
      setDisplay(Math.round(latest));
    });
    return () => unsub();
  }, [value, spring, prefersReduced]);

  return (
    <span className={`tabular-nums ${className}`}>
      {display.toLocaleString('vi-VN')}₫
    </span>
  );
};
