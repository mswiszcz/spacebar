use clap::{Parser, Subcommand};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::process;
use std::thread;
use std::time::{Duration, Instant};

#[derive(Parser)]
#[command(name = "spacebar", about = "CLI for Spacebar")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Register a new agent session
    Register {
        #[arg(long)]
        agent: String,
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        on_click: String,
    },
    /// Update an agent's state
    Update {
        #[arg(long)]
        session_id: String,
        #[arg(long)]
        state: String,
    },
    /// Remove an agent session
    Remove {
        #[arg(long)]
        session_id: String,
    },
    /// Check if the app is running
    Health,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisterBody {
    agent: String,
    session_id: String,
    on_click: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdateBody {
    session_id: String,
    state: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoveBody {
    session_id: String,
}

fn port_file_path() -> PathBuf {
    dirs::home_dir()
        .expect("cannot find home directory")
        .join(".spacebar.port")
}

fn get_base_url() -> Option<String> {
    let port = fs::read_to_string(port_file_path()).ok()?;
    let port = port.trim();
    if port.is_empty() {
        return None;
    }
    Some(format!("http://127.0.0.1:{port}"))
}

fn is_app_reachable(base_url: &str) -> bool {
    ureq::get(format!("{base_url}/health"))
        .call()
        .is_ok()
}

fn launch_and_wait() -> String {
    eprintln!("Spacebar is not running, starting it...");

    process::Command::new("open")
        .arg("-a")
        .arg("Spacebar")
        .status()
        .unwrap_or_else(|e| {
            eprintln!("Failed to launch Spacebar: {e}");
            process::exit(1);
        });

    let timeout = Duration::from_secs(15);
    let poll_interval = Duration::from_millis(200);
    let start = Instant::now();

    loop {
        if start.elapsed() > timeout {
            eprintln!("Timed out waiting for Spacebar to start");
            process::exit(1);
        }

        if let Some(url) = get_base_url() {
            if is_app_reachable(&url) {
                return url;
            }
        }

        thread::sleep(poll_interval);
    }
}

fn get_base_url_or_exit() -> String {
    match get_base_url() {
        Some(url) if is_app_reachable(&url) => url,
        _ => {
            eprintln!("Spacebar is not running (no port file found)");
            process::exit(1);
        }
    }
}

fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Commands::Register {
            agent,
            session_id,
            on_click,
        } => {
            let base_url = match get_base_url() {
                Some(url) if is_app_reachable(&url) => url,
                _ => launch_and_wait(),
            };
            let body = RegisterBody {
                agent,
                session_id,
                on_click,
            };
            ureq::post(format!("{base_url}/register"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Update { session_id, state } => {
            let base_url = get_base_url_or_exit();
            let body = UpdateBody { session_id, state };
            ureq::post(format!("{base_url}/update"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Remove { session_id } => {
            let base_url = get_base_url_or_exit();
            let body = RemoveBody { session_id };
            ureq::post(format!("{base_url}/remove"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Health => {
            let base_url = get_base_url_or_exit();
            ureq::get(format!("{base_url}/health"))
                .call()
                .map(|_| ())
        }
    };

    match result {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    }
}
