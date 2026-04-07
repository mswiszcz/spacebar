use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub orientation: String,
    pub always_on_top: bool,
    pub mascot_size: String,
    pub show_labels: bool,
    pub show_tooltips: bool,
    pub position: Position,
    #[serde(default = "default_sound_enabled")]
    pub sound_enabled: bool,
    #[serde(default = "default_sound_volume")]
    pub sound_volume: f64,
    #[serde(default = "default_sound_pack")]
    pub sound_pack: String,
    pub theme: ThemeConfig,
    #[serde(default)]
    pub group_renames: HashMap<String, String>,
    #[serde(default)]
    pub snap: SnapConfig,
    #[serde(default)]
    pub split_view: SplitViewConfig,
    #[serde(default)]
    pub display_modes: HashMap<String, String>,
    #[serde(default = "default_status_dot_corner")]
    pub status_dot_corner: String,
    #[serde(default)]
    pub states: HashMap<String, StateConfig>,
    #[serde(default = "default_bind")]
    pub bind: String,
    #[serde(default)]
    pub port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateConfig {
    pub icon_color: Option<String>,
    pub dot_color: Option<String>,
    pub sound_override: Option<String>,
    #[serde(default)]
    pub muted: bool,
}

fn default_status_dot_corner() -> String {
    "top-left".into()
}

fn default_bind() -> String {
    "127.0.0.1".into()
}

fn default_sound_enabled() -> bool {
    true
}

fn default_sound_volume() -> f64 {
    0.5
}

fn default_sound_pack() -> String {
    "default".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background_color: String,
    pub background_opacity: f64,
    pub blur_radius: u32,
    pub accent_color: String,
    #[serde(default = "default_entity_gap")]
    pub entity_gap: u32,
    #[serde(default = "default_group_gap")]
    pub group_gap: u32,
}

fn default_entity_gap() -> u32 {
    8
}

fn default_group_gap() -> u32 {
    12
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapConfig {
    pub enabled: bool,
    pub edge_padding: u32,
    pub snapped_edge: Option<String>,
}

impl Default for SnapConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            edge_padding: 4,
            snapped_edge: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitViewConfig {
    pub overflow_behavior: String,
}

impl Default for SplitViewConfig {
    fn default() -> Self {
        Self {
            overflow_behavior: "scroll".into(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            orientation: "horizontal".into(),
            always_on_top: true,
            mascot_size: "medium".into(),
            show_labels: true,
            show_tooltips: true,
            position: Position { x: 100.0, y: 100.0 },
            sound_enabled: true,
            sound_volume: 0.5,
            sound_pack: "default".into(),
            theme: ThemeConfig {
                background_color: "#1a1a2e".into(),
                background_opacity: 0.8,
                blur_radius: 20,
                accent_color: "#E8825A".into(),
                entity_gap: default_entity_gap(),
                group_gap: default_group_gap(),
            },
            group_renames: HashMap::new(),
            snap: SnapConfig::default(),
            split_view: SplitViewConfig::default(),
            display_modes: HashMap::new(),
            status_dot_corner: default_status_dot_corner(),
            states: HashMap::new(),
            bind: default_bind(),
            port: None,
        }
    }
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .expect("cannot find home directory")
        .join(".spacebar")
        .join("config.json")
}

pub fn load_config() -> Config {
    let path = config_path();
    if path.exists() {
        let data = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        Config::default()
    }
}

pub fn save_config(config: &Config) {
    let path = config_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let data = serde_json::to_string_pretty(config).unwrap();
    let _ = fs::write(path, data);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config_serializes() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.orientation, "horizontal");
        assert_eq!(parsed.theme.blur_radius, 20);
        assert!(parsed.sound_enabled);
        assert_eq!(parsed.sound_pack, "default");
        assert!(parsed.states.is_empty());
    }

    #[test]
    fn test_state_config_deserializes() {
        let json = r##"{"iconColor": "#ff0000", "dotColor": "#00ff00", "muted": true}"##;
        let parsed: StateConfig = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.icon_color, Some("#ff0000".into()));
        assert_eq!(parsed.dot_color, Some("#00ff00".into()));
        assert!(parsed.muted);
        assert!(parsed.sound_override.is_none());
    }

    #[test]
    fn test_snap_config_defaults() {
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "theme": {
                "backgroundColor": "#1a1a2e",
                "backgroundOpacity": 0.8,
                "blurRadius": 20,
                "accentColor": "#E8825A"
            }
        }"##;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert!(!parsed.snap.enabled);
        assert_eq!(parsed.snap.edge_padding, 4);
        assert!(parsed.snap.snapped_edge.is_none());
        assert!(parsed.sound_enabled);
        assert!(parsed.states.is_empty());
    }

    #[test]
    fn test_bind_and_port_defaults() {
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "theme": {
                "backgroundColor": "#1a1a2e",
                "backgroundOpacity": 0.8,
                "blurRadius": 20,
                "accentColor": "#E8825A"
            }
        }"##;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.bind, "127.0.0.1");
        assert_eq!(parsed.port, None);
    }

    #[test]
    fn test_bind_and_port_explicit() {
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "theme": {
                "backgroundColor": "#1a1a2e",
                "backgroundOpacity": 0.8,
                "blurRadius": 20,
                "accentColor": "#E8825A"
            },
            "bind": "0.0.0.0",
            "port": 9876
        }"##;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.bind, "0.0.0.0");
        assert_eq!(parsed.port, Some(9876));
    }
}
