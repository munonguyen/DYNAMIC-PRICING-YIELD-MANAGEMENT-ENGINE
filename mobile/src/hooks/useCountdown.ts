import { useCallback, useEffect, useState } from 'react';

export function useCountdown(initialSeconds = 600) {
  const [seconds, setSeconds] = useState<number>(initialSeconds);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const reset = useCallback((nextSeconds = initialSeconds) => {
    setSeconds(nextSeconds);
  }, [initialSeconds]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return {
    seconds,
    isExpired: seconds === 0,
    formatted: seconds === 0 ? 'HẾT HẠN' : `${mm}:${ss}`,
    reset,
  };
}

