use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_id: String,
    pub agent: String,
    pub state: String,
    pub on_click: String,
    pub registered_at: u64,
}

#[derive(Debug, Default)]
pub struct SessionStore {
    sessions: Mutex<HashMap<String, Session>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(&self, agent: String, session_id: String, on_click: String) -> Session {
        let session = Session {
            session_id: session_id.clone(),
            agent,
            state: "entering".to_string(),
            on_click,
            registered_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        self.sessions
            .lock()
            .unwrap()
            .insert(session_id, session.clone());
        session
    }

    pub fn update(&self, session_id: &str, state: String) -> Option<Session> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(session) = sessions.get_mut(session_id) {
            session.state = state;
            Some(session.clone())
        } else {
            None
        }
    }

    pub fn remove(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().remove(session_id)
    }

    pub fn get(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    pub fn all(&self) -> Vec<Session> {
        self.sessions.lock().unwrap().values().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_register_creates_session_with_entering_state() {
        let store = SessionStore::new();
        let session = store.register(
            "claude-code".into(),
            "sess-1".into(),
            "wsh view focus".into(),
        );
        assert_eq!(session.session_id, "sess-1");
        assert_eq!(session.agent, "claude-code");
        assert_eq!(session.state, "entering");
        assert_eq!(session.on_click, "wsh view focus");
        assert!(session.registered_at > 0);
    }

    #[test]
    fn test_update_changes_state() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "sess-1".into(), "cmd".into());
        let updated = store.update("sess-1", "thinking".into());
        assert_eq!(updated.unwrap().state, "thinking");
    }

    #[test]
    fn test_update_nonexistent_returns_none() {
        let store = SessionStore::new();
        assert!(store.update("nope", "thinking".into()).is_none());
    }

    #[test]
    fn test_remove_returns_session_and_deletes() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "sess-1".into(), "cmd".into());
        let removed = store.remove("sess-1");
        assert!(removed.is_some());
        assert!(store.get("sess-1").is_none());
    }

    #[test]
    fn test_all_returns_all_sessions() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "s1".into(), "cmd".into());
        store.register("claude-code".into(), "s2".into(), "cmd".into());
        assert_eq!(store.all().len(), 2);
    }
}
