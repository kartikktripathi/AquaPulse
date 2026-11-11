class ReportEvents {
  constructor() {
    this.listeners = {};
  }

  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event, listener) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(function (l) {
      return l !== listener;
    });
  }

  emit(event, ...args) {
    const list = this.listeners[event];
    if (!list) {
      return;
    }
    list.slice().forEach(function (listener) {
      try {
        listener(...args);
      } catch (e) {}
    });
  }
}

export const reportEvents = new ReportEvents();
export default reportEvents;

