export class AutoSaveManager {
    private autoSave: boolean;
    private saveInterval: number;
    private saveCallback: () => void;
    private intervalId: NodeJS.Timeout | null = null;
  
    constructor(autoSave: boolean, saveInterval: number, saveCallback: () => void) {
      this.autoSave = autoSave;
      this.saveInterval = saveInterval;
      this.saveCallback = saveCallback;
    }
  
    start(): void {
      if (this.autoSave && !this.intervalId) {
        this.intervalId = setInterval(() => {
          this.saveCallback();
        }, this.saveInterval);
      }
    }
  
    stop(): void {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  }
  