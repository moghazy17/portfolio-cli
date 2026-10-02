'use client';

import { m, useReducedMotion } from 'motion/react';

interface Props {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

// The server renders the hidden state, so the layout adds a <noscript> rule that shows it again
// when scripts are off. Reduced motion only changes the transition: the hook's value can differ
// between server and first client render, but a transition is never part of the markup.
export default function Reveal({ children, className, delay = 0 }: Props) {
  const reduce = useReducedMotion();
  return (
    <m.div
      className={className}
      data-reveal
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut', delay }}
    >
      {children}
    </m.div>
  );
}
