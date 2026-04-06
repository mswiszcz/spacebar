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
    pub sound: SoundConfig,
    pub theme: ThemeConfig,
    #[serde(default)]
    pub group_renames: HashMap<String, String>,
    #[serde(default)]
    pub snap: SnapConfig,
    #[serde(default)]
    pub split_view: SplitViewConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoundConfig {
    pub enabled: bool,
    pub volume: f64,
    #[serde(default = "default_pack")]
    pub pack: String,
    #[serde(default)]
    pub overrides: HashMap<String, String>,
    #[serde(default)]
    pub muted: Vec<String>,
}

fn default_pack() -> String {
    "default".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background_color: String,
    pub background_opacity: f64,
    pub blur_radius: u32,
    pub accent_color: String,
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
            sound: SoundConfig {
                enabled: true,
                volume: 0.5,
                pack: "default".into(),
                overrides: HashMap::new(),
                muted: vec![],
            },
            theme: ThemeConfig {
                background_color: "#1a1a2e".into(),
                background_opacity: 0.8,
                blur_radius: 20,
                accent_color: "#E8825A".into(),
            },
            group_renames: HashMap::new(),
            snap: SnapConfig::default(),
            split_view: SplitViewConfig::default(),
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
    fn test_sound_config_backward_compat() {
        let json = r#"{"enabled": true, "volume": 0.5}"#;
        let parsed: SoundConfig = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.pack, "default");
        assert!(parsed.overrides.is_empty());
        assert!(parsed.muted.is_empty());
    }

    #[test]
    fn test_snap_config_backward_compat() {
        // Config without snap field should deserialize with defaults
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "sound": {"enabled": true, "volume": 0.5},
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
    }

    #[test]
    fn test_split_view_config_backward_compat() {
        // Config without split_view field should deserialize with defaults
        let json = r##"{
            "orientation": "horizontal",
            "alwaysOnTop": true,
            "mascotSize": "medium",
            "showLabels": true,
            "showTooltips": true,
            "position": {"x": 100, "y": 100},
            "sound": {"enabled": true, "volume": 0.5},
            "theme": {
                "backgroundColor": "#1a1a2e",
                "backgroundOpacity": 0.8,
                "blurRadius": 20,
                "accentColor": "#E8825A"
            }
        }"##;
        let parsed: Config = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.split_view.overflow_behavior, "scroll");
    }

    #[test]
    fn test_default_config_serializes() {
        let config = Config::default();
        let json = serde_json::to_string(&config).unwrap();
        let parsed: Config = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.orientation, "horizontal");
        assert_eq!(parsed.theme.blur_radius, 20);
        assert!(parsed.sound.enabled);
    }
}
