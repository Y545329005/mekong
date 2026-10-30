export class ComputeSpaceBackground {
  constructor(container: HTMLElement, options?: { speed?: number });
  setPaused(value: boolean): void;
  setSpeed(value: number): void;
  destroy(): void;
}
