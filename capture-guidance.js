export function countdownLabel(seconds) {
  return `촬영 시작까지 ${seconds}초`;
}

export function remainingTimeLabel(milliseconds) {
  return `남은 시간 ${Math.max(0, Math.ceil(milliseconds / 1000))}초`;
}

export function soundCue(type, countdownSecond = 3) {
  if (type === "countdown") {
    return {
      frequency: 520 + (3 - countdownSecond) * 120,
      duration: 0.12,
      pattern: "single"
    };
  }
  if (type === "start") return { frequency: 920, duration: 0.12, pattern: "double" };
  if (type === "tick") return { frequency: 360, duration: 0.08, pattern: "single" };
  if (type === "complete") return { frequency: 720, duration: 0.9, pattern: "single" };
  throw new Error(`알 수 없는 알림음입니다: ${type}`);
}

export function needsDestructiveConfirmation(hasResult) {
  return Boolean(hasResult);
}
