import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHorizontalOverflow, calculateVerticalScroll } from './scroll-state';

test('classifies short and long vertical pages without invalid progress', () => {
  assert.deepEqual(calculateVerticalScroll({ scrollTop: 0, scrollHeight: 900, clientHeight: 900 }), {
    isLongPage: false,
    isScrolled: false,
    showBackToTop: false,
    progress: 0,
  });
  assert.deepEqual(calculateVerticalScroll({ scrollTop: 600, scrollHeight: 1800, clientHeight: 800 }), {
    isLongPage: true,
    isScrolled: true,
    showBackToTop: true,
    progress: 0.6,
  });
});

test('clamps vertical progress to the valid range', () => {
  assert.equal(calculateVerticalScroll({ scrollTop: -20, scrollHeight: 1800, clientHeight: 800 }).progress, 0);
  assert.equal(calculateVerticalScroll({ scrollTop: 1400, scrollHeight: 1800, clientHeight: 800 }).progress, 1);
});

test('reports horizontal overflow at every scroll position', () => {
  assert.deepEqual(calculateHorizontalOverflow({ scrollLeft: 0, clientWidth: 500, scrollWidth: 900 }), { left: false, right: true });
  assert.deepEqual(calculateHorizontalOverflow({ scrollLeft: 200, clientWidth: 500, scrollWidth: 900 }), { left: true, right: true });
  assert.deepEqual(calculateHorizontalOverflow({ scrollLeft: 400, clientWidth: 500, scrollWidth: 900 }), { left: true, right: false });
  assert.deepEqual(calculateHorizontalOverflow({ scrollLeft: 0, clientWidth: 900, scrollWidth: 900 }), { left: false, right: false });
});
