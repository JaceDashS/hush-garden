/** Pure running-state pub/sub tracker shared with GardenAudio so UI play/mute icons never drift from AudioContext state. */
export class AudioRunningTracker {
  private listeners = new Set<(running: boolean) => void>();
  private current = false;

  get running(): boolean {
    return this.current;
  }

  subscribe(listener: (running: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(running: boolean): void {
    this.current = running;
    for (const listener of this.listeners) listener(running);
  }
}
