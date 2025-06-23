import { useMemo } from 'react';
import { useViewportWidth } from './use-viewport-width';

export function useTableContainerWidth() {
  const viewportWidth = useViewportWidth();

  const containerWidth = useMemo(() => {
    // SSR 중이거나 viewportWidth가 아직 설정되지 않은 경우
    if (viewportWidth === undefined) return undefined;

    const calculatedWidth = viewportWidth - (viewportWidth < 640 ? 24 : 74);
    console.log('calculatedWidth', calculatedWidth);
    console.log('viewportWidth', viewportWidth);
    return `${calculatedWidth}px`;
  }, [viewportWidth]);

  return containerWidth;
}
