import { useState, useEffect, useRef, useCallback } from "react";

export function useDebounce<T>(value: T, delay: number = 180): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 콜백 자체를 지연 실행하는 debounce 훅. 값이 아니라 '이벤트'를 늦추고 싶을 때 쓴다.
 *
 * 반환된 `cancel()` 은 대기 중인 호출을 취소한다. 마우스가 잠깐 스쳐 지나간 대상에
 * 비싼 요청(예: 수 MB 응답)을 보내지 않으려면 `onMouseEnter` 에서 `run()`,
 * `onMouseLeave` 에서 `cancel()` 을 호출하면 된다.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number = 200
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 콜백이 매 렌더 새로 만들어져도 타이머가 오래된 클로저를 호출하지 않도록 최신값을 참조한다.
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const run = useCallback(
    (...args: A) => {
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        callbackRef.current(...args);
      }, delay);
    },
    [cancel, delay]
  );

  // 언마운트 시 대기 중인 타이머가 살아남지 않게 정리한다.
  useEffect(() => cancel, [cancel]);

  return { run, cancel };
}
