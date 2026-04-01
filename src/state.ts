export interface Session {
  sessionId: string;
  agent: string;
  state: string;
  onClick: string | null;
  registeredAt: number;
  pwd: string | null;
  groupId: string;
}

export interface Group {
  groupId: string;
  pwd: string | null;
  displayName: string | null;
  sessionIds: string[];
}

type Listener = (sessions: Session[]) => void;
type GroupListener = (groups: Group[]) => void;

class SessionState {
  private sessions: Map<string, Session> = new Map();
  private listeners: Listener[] = [];
  private groups: Map<string, Group> = new Map();
  private groupListeners: GroupListener[] = [];

  add(session: Session): void {
    this.sessions.set(session.sessionId, session);
    this.notify();
  }

  update(session: Partial<Session> & { sessionId: string }): void {
    const existing = this.sessions.get(session.sessionId);
    if (existing) {
      existing.state = session.state ?? existing.state;
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

  addGroup(group: Group): void {
    this.groups.set(group.groupId, group);
    this.notifyGroups();
  }

  updateGroup(group: Group): void {
    this.groups.set(group.groupId, group);
    this.notifyGroups();
  }

  removeGroup(groupId: string): void {
    this.groups.delete(groupId);
    this.notifyGroups();
  }

  getAllGroups(): Group[] {
    return Array.from(this.groups.values());
  }

  getGroup(groupId: string): Group | undefined {
    return this.groups.get(groupId);
  }

  subscribeGroups(listener: GroupListener): () => void {
    this.groupListeners.push(listener);
    return () => {
      this.groupListeners = this.groupListeners.filter((l) => l !== listener);
    };
  }

  private notifyGroups(): void {
    const all = this.getAllGroups();
    this.groupListeners.forEach((l) => l(all));
  }
}

export const sessionState = new SessionState();
