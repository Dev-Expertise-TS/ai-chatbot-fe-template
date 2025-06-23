import { useState, useEffect } from 'react';

export function useViewportWidth() {
  
  // SSR 중에는 undefined를 반환하여 하이드레이션 문제 방지
  const [viewportWidth, setViewportWidth] = useState<number | undefined>(undefined);
  
  useEffect(() => {
    
    // 클라이언트 사이드에서만 실행
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setViewportWidth(newWidth);
    };

    // 초기값 설정
    handleResize();
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewportWidth;
}