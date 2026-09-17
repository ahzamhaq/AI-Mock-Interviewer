import { useEffect, useRef, useState } from 'react';

// Ticks up once per second while `active` is true, resets to 0 otherwise.
// Used to show reassurance copy ("still working...") during AI calls that
// can legitimately take several seconds, so a slow response doesn't read
// as a frozen UI.
export default function useElapsedSeconds(active) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (active) {
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      setSeconds(0);
    }
    return () => clearInterval(intervalRef.current);
  }, [active]);

  return seconds;
}
