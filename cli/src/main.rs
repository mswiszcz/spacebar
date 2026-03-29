use clap::{Parser, Subcommand};
use serde::Serialize;
use std::fs;
use std::process;

#[derive(Parser)]
#[command(name = "agentmonitor", about = "CLI for Agent Monitor")]
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

fn get_base_url() -> String {
    let port_file = dirs::home_dir()
        .expect("cannot find home directory")
        .join(".agentmonitor.port");

    let port = fs::read_to_string(&port_file).unwrap_or_else(|_| {
        eprintln!("Agent Monitor is not running (no port file found)");
        process::exit(1);
    });

    let port = port.trim();
    format!("http://127.0.0.1:{port}")
}

fn main() {
    let cli = Cli::parse();
    let base_url = get_base_url();

    let result = match cli.command {
        Commands::Register {
            agent,
            session_id,
            on_click,
        } => {
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
            let body = UpdateBody { session_id, state };
            ureq::post(format!("{base_url}/update"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Remove { session_id } => {
            let body = RemoveBody { session_id };
            ureq::post(format!("{base_url}/remove"))
                .send_json(&body)
                .map(|_| ())
        }
        Commands::Health => ureq::get(format!("{base_url}/health"))
            .call()
            .map(|_| ()),
    };

    match result {
        Ok(()) => {}
        Err(e) => {
            eprintln!("Error: {e}");
            process::exit(1);
        }
    }
}
