export interface Session {
  sessionId: string;
  agent: string;
  state: string;
  onClick: string;
  registeredAt: number;
}

type Listener = (sessions: Session[]) => void;

class SessionState {
  private sessions: Map<string, Session> = new Map();
  private listeners: Listener[] = [];

  add(session: Session): void {
    this.sessions.set(session.sessionId, session);
    this.notify();
  }

  update(session: Session): void {
    const existing = this.sessions.get(session.sessionId);
    if (existing) {
      existing.state = session.state;
      this.notify();
    }
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.notify();
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const all = this.getAll();
    this.listeners.forEach((l) => l(all));
  }
}

export const sessionState = new SessionState();
