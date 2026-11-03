let connectionLost = false;
const listeners = new Set<() => void>();

export const reportConnection = (lost: boolean) => {
  if (connectionLost === lost) return;
  connectionLost = lost;
  listeners.forEach((listener) => listener());
};
export const connectionSnapshot = () => connectionLost;
export const subscribeConnection = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
