use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub session_id: String,
    pub agent: String,
    pub state: String,
    pub on_click: Option<String>,
    pub registered_at: u64,
    pub pwd: Option<String>,
    pub group_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub group_id: String,
    pub pwd: Option<String>,
    pub display_name: Option<String>,
    pub session_ids: Vec<String>,
    pub created_at: u64,
}

fn compute_group_id(pwd: &str) -> String {
    let hash = Sha256::digest(pwd.as_bytes());
    hash.iter().take(8).map(|b| format!("{:02x}", b)).collect()
}

#[derive(Debug, Default)]
pub struct SessionStore {
    sessions: Mutex<HashMap<String, Session>>,
    groups: Mutex<HashMap<String, Group>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            groups: Mutex::new(HashMap::new()),
        }
    }

    pub fn register(
        &self,
        agent: String,
        session_id: String,
        on_click: Option<String>,
        pwd: Option<String>,
        display_name: Option<String>,
        group_renames: &HashMap<String, String>,
    ) -> (Session, Group, bool) {
        let group_id = match &pwd {
            Some(p) => compute_group_id(p),
            None => "anonymous".to_string(),
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut groups = self.groups.lock().unwrap();
        let is_new_group;
        let group = if let Some(existing) = groups.get_mut(&group_id) {
            existing.session_ids.push(session_id.clone());
            is_new_group = false;
            existing.clone()
        } else {
            let resolved_name = match &pwd {
                Some(p) => {
                    if let Some(renamed) = group_renames.get(p) {
                        Some(renamed.clone())
                    } else if let Some(dn) = &display_name {
                        Some(dn.clone())
                    } else {
                        p.rsplit('/').next().map(|s| s.to_string())
                    }
                }
                None => None,
            };
            let new_group = Group {
                group_id: group_id.clone(),
                pwd: pwd.clone(),
                display_name: resolved_name,
                session_ids: vec![session_id.clone()],
                created_at: now,
            };
            groups.insert(group_id.clone(), new_group.clone());
            is_new_group = true;
            new_group
        };

        let session = Session {
            session_id: session_id.clone(),
            agent,
            state: "idle".to_string(),
            on_click,
            registered_at: now,
            pwd,
            group_id,
        };
        self.sessions
            .lock()
            .unwrap()
            .insert(session_id, session.clone());

        (session, group, is_new_group)
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

    pub fn remove(&self, session_id: &str) -> Option<(Session, Group, bool)> {
        let session = self.sessions.lock().unwrap().remove(session_id)?;
        let mut groups = self.groups.lock().unwrap();

        if let Some(group) = groups.get_mut(&session.group_id) {
            group.session_ids.retain(|id| id != session_id);
            if group.session_ids.is_empty() {
                let group = groups.remove(&session.group_id).unwrap();
                Some((session, group, true))
            } else {
                Some((session, group.clone(), false))
            }
        } else {
            // Group somehow missing — return session with a placeholder
            let placeholder = Group {
                group_id: session.group_id.clone(),
                pwd: session.pwd.clone(),
                display_name: None,
                session_ids: vec![],
                created_at: 0,
            };
            Some((session, placeholder, true))
        }
    }

    pub fn get(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().unwrap().get(session_id).cloned()
    }

    pub fn all(&self) -> Vec<Session> {
        self.sessions.lock().unwrap().values().cloned().collect()
    }

    pub fn all_groups(&self) -> Vec<Group> {
        let mut groups: Vec<Group> = self.groups.lock().unwrap().values().cloned().collect();
        groups.sort_by_key(|g| g.created_at);
        groups
    }

    pub fn get_group(&self, group_id: &str) -> Option<Group> {
        self.groups.lock().unwrap().get(group_id).cloned()
    }

    pub fn rename_group(&self, group_id: &str, display_name: String) -> Option<Group> {
        let mut groups = self.groups.lock().unwrap();
        if let Some(group) = groups.get_mut(group_id) {
            group.display_name = Some(display_name);
            Some(group.clone())
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn empty_renames() -> HashMap<String, String> {
        HashMap::new()
    }

    #[test]
    fn test_register_creates_session_with_idle_state() {
        let store = SessionStore::new();
        let (session, _group, _is_new) = store.register(
            "claude-code".into(),
            "sess-1".into(),
            Some("wsh view focus".into()),
            None,
            None,
            &empty_renames(),
        );
        assert_eq!(session.session_id, "sess-1");
        assert_eq!(session.agent, "claude-code");
        assert_eq!(session.state, "idle");
        assert_eq!(session.on_click, Some("wsh view focus".into()));
        assert!(session.registered_at > 0);
    }

    #[test]
    fn test_update_changes_state() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "sess-1".into(), Some("cmd".into()), None, None, &empty_renames());
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
        store.register("claude-code".into(), "sess-1".into(), Some("cmd".into()), None, None, &empty_renames());
        let removed = store.remove("sess-1");
        assert!(removed.is_some());
        assert!(store.get("sess-1").is_none());
    }

    #[test]
    fn test_all_returns_all_sessions() {
        let store = SessionStore::new();
        store.register("claude-code".into(), "s1".into(), Some("cmd".into()), None, None, &empty_renames());
        store.register("claude-code".into(), "s2".into(), Some("cmd".into()), None, None, &empty_renames());
        assert_eq!(store.all().len(), 2);
    }

    #[test]
    fn test_register_with_pwd_creates_group() {
        let store = SessionStore::new();
        let (session, group, is_new) = store.register(
            "claude-code".into(),
            "sess-1".into(),
            Some("cmd".into()),
            Some("/Users/test/project".into()),
            None,
            &empty_renames(),
        );
        assert!(is_new);
        assert_eq!(group.display_name, Some("project".into()));
        assert_eq!(group.pwd, Some("/Users/test/project".into()));
        assert_eq!(session.group_id, group.group_id);
        assert_eq!(group.session_ids, vec!["sess-1"]);
    }

    #[test]
    fn test_register_same_pwd_reuses_group() {
        let store = SessionStore::new();
        let (_s1, g1, is_new1) = store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        let (_s2, g2, is_new2) = store.register(
            "claude-code".into(), "s2".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        assert!(is_new1);
        assert!(!is_new2);
        assert_eq!(g1.group_id, g2.group_id);
        assert_eq!(g2.session_ids, vec!["s1", "s2"]);
    }

    #[test]
    fn test_register_no_pwd_uses_anonymous() {
        let store = SessionStore::new();
        let (session, group, _) = store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            None, None, &empty_renames(),
        );
        assert_eq!(session.group_id, "anonymous");
        assert_eq!(group.group_id, "anonymous");
        assert!(group.display_name.is_none());
    }

    #[test]
    fn test_remove_last_session_removes_group() {
        let store = SessionStore::new();
        store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        let (_, _, group_empty) = store.remove("s1").unwrap();
        assert!(group_empty);
        assert!(store.all_groups().is_empty());
    }

    #[test]
    fn test_remove_non_last_keeps_group() {
        let store = SessionStore::new();
        store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        store.register(
            "claude-code".into(), "s2".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        let (_, group, group_empty) = store.remove("s1").unwrap();
        assert!(!group_empty);
        assert_eq!(group.session_ids, vec!["s2"]);
    }

    #[test]
    fn test_rename_group() {
        let store = SessionStore::new();
        let (_, group, _) = store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), None, &empty_renames(),
        );
        let renamed = store.rename_group(&group.group_id, "My Project".into());
        assert_eq!(renamed.unwrap().display_name, Some("My Project".into()));
    }

    #[test]
    fn test_group_renames_config_takes_precedence() {
        let store = SessionStore::new();
        let mut renames = HashMap::new();
        renames.insert("/Users/test/project".to_string(), "Custom Name".to_string());
        let (_, group, _) = store.register(
            "claude-code".into(), "s1".into(), Some("cmd".into()),
            Some("/Users/test/project".into()), Some("Override".into()), &renames,
        );
        assert_eq!(group.display_name, Some("Custom Name".into()));
    }
}
