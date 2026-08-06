import { AnimatePresence, m } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { motionTransitions, pageVariants } from './motion-config';
import { usePanelReducedMotion } from './motion-provider';

export function focusPageHeading(): void {
  document.querySelector<HTMLElement>('[data-page-heading]')?.focus({ preventScroll: true });
}

export function PageTransition({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const shouldReduceMotion = usePanelReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [location, shouldReduceMotion]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        className="page-transition"
        data-testid="page-transition"
        key={location}
        variants={pageVariants(shouldReduceMotion)}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={motionTransitions.route}
        onAnimationComplete={definition => {
          if (definition === 'animate') focusPageHeading();
        }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
