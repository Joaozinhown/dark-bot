import { ArrowUp } from 'lucide-react';
import { AnimatePresence, m, useScroll, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { calculateVerticalScroll } from '../lib/scroll-state';
import { focusPageHeading } from '../motion/page-transition';
import { usePanelReducedMotion } from '../motion/motion-provider';

export function WorkspaceScroll({ onScrolledChange }: { onScrolledChange: (isScrolled: boolean) => void }) {
  const shouldReduceMotion = usePanelReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 280, damping: 36, mass: 0.35, skipInitialAnimation: true });
  const [isLongPage, setIsLongPage] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const scrollState = calculateVerticalScroll({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: window.innerHeight,
      });
      setShowBackToTop(current => current === scrollState.showBackToTop ? current : scrollState.showBackToTop);
      onScrolledChange(scrollState.isScrolled);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [onScrolledChange]);

  useEffect(() => {
    let frame = 0;
    const updateLength = () => {
      frame = 0;
      setIsLongPage(calculateVerticalScroll({
        scrollTop: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: window.innerHeight,
      }).isLongPage);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(updateLength);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const observeCurrentPage = () => {
      const page = document.querySelector<HTMLElement>('.page');
      if (page) resizeObserver.observe(page);
    };
    const mutationObserver = new MutationObserver(() => {
      observeCurrentPage();
      schedule();
    });
    resizeObserver.observe(document.documentElement);
    resizeObserver.observe(document.body);
    const content = document.querySelector<HTMLElement>('.workspace__content');
    if (content) resizeObserver.observe(content);
    observeCurrentPage();
    mutationObserver.observe(content ?? document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const returnToTop = () => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    window.setTimeout(focusPageHeading, shouldReduceMotion ? 0 : 220);
  };

  return (
    <>
      {isLongPage && !shouldReduceMotion ? (
        <m.div className="scroll-progress" style={{ scaleX: progress }} data-testid="workspace-scroll-progress" aria-hidden="true" />
      ) : null}
      <AnimatePresence>
      {isLongPage && showBackToTop ? (
        <m.button
          className="back-to-top icon-button"
          type="button"
          aria-label="Voltar ao topo"
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          onClick={returnToTop}
        >
          <ArrowUp aria-hidden="true" />
        </m.button>
      ) : null}
      </AnimatePresence>
    </>
  );
}
