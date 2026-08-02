import type { Transition, Variants } from 'motion/react';

export const motionTransitions = {
  interface: { duration: 0.18, ease: [0.25, 1, 0.5, 1] } satisfies Transition,
  route: { duration: 0.2, ease: [0.25, 1, 0.5, 1] } satisfies Transition,
} as const;

export function pageVariants(shouldReduceMotion: boolean): Variants {
  return {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 0 },
  };
}

export function popoverVariants(shouldReduceMotion: boolean, offset = -6): Variants {
  return {
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : offset, scale: shouldReduceMotion ? 1 : 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : offset / 2, scale: shouldReduceMotion ? 1 : 0.99 },
  };
}
