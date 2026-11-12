/** Game/UI events exist before Phaser injects scene plugins during boot. */
export class Signals {
  private listeners = new Map<string, Set<(...args:any[])=>void>>();
  on(name:string, listener:(...args:any[])=>void){const set=this.listeners.get(name)??new Set();set.add(listener);this.listeners.set(name,set);return this}
  emit(name:string,...args:any[]){for(const listener of this.listeners.get(name)??[])listener(...args);return this}
}
