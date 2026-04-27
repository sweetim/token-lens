import { useState, useEffect, useRef } from "preact/hooks";

const BATCH_SIZE = 20;

function useIntersectionLazyLoad(totalItems: number) {
  const [visibleCount, setVisibleCount] = useState(() => Math.min(BATCH_SIZE, totalItems));
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisibleCount(Math.min(BATCH_SIZE, totalItems));
  }, [totalItems]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= totalItems) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, totalItems));
        }
      },
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleCount, totalItems]);

  return { visibleCount, sentinelRef };
}

export { useIntersectionLazyLoad };
