import { domAnimation, LazyMotion, MotionConfig, useReducedMotion } from 'motion/react';
import { createContext, useContext, type ReactNode } from 'react';
import { motionTransitions } from './motion-config';

const ReducedMotionContext = createContext(false);

export function MotionProvider({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <ReducedMotionContext.Provider value={shouldReduceMotion}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user" transition={motionTransitions.interface}>
          {children}
        </MotionConfig>
      </LazyMotion>
    </ReducedMotionContext.Provider>
  );
}

export function usePanelReducedMotion(): boolean {
  return useContext(ReducedMotionContext);
}
