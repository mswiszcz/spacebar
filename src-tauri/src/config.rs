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
            },
            theme: ThemeConfig {
                background_color: "#1a1a2e".into(),
                background_opacity: 0.8,
                blur_radius: 20,
                accent_color: "#E8825A".into(),
            },
            group_renames: HashMap::new(),
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
