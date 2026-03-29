use serde::{Deserialize, Serialize};
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeConfig {
    pub background_color: String,
    pub background_opacity: f64,
    pub vibrancy_material: String,
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
            },
            theme: ThemeConfig {
                background_color: "#1a1a2e".into(),
                background_opacity: 0.8,
                vibrancy_material: "HudWindow".into(),
                accent_color: "#E8825A".into(),
            },
        }
    }
}

fn config_path() -> PathBuf {
    dirs::home_dir()
        .expect("cannot find home directory")
        .join(".agentmonitor")
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
        assert_eq!(parsed.theme.vibrancy_material, "HudWindow");
        assert!(parsed.sound.enabled);
    }
}
