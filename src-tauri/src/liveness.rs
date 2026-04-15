/// Returns `true` if a process with the given PID exists.
///
/// Uses `kill(pid, 0)` which sends no signal but performs the existence and
/// permission checks. `Ok` ⇒ alive. `Err(EPERM)` ⇒ exists but owned by a
/// different uid. `Err(ESRCH)` ⇒ no such process.
pub fn is_alive(pid: u32) -> bool {
    let ret = unsafe { libc::kill(pid as libc::pid_t, 0) };
    if ret == 0 {
        return true;
    }
    let errno = errno();
    errno == libc::EPERM
}

#[cfg(target_os = "macos")]
fn errno() -> i32 {
    unsafe { *libc::__error() }
}

#[cfg(target_os = "linux")]
fn errno() -> i32 {
    unsafe { *libc::__errno_location() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::{Command, Stdio};

    #[test]
    fn is_alive_returns_true_for_self() {
        assert!(is_alive(std::process::id()));
    }

    #[test]
    fn is_alive_returns_false_for_dead_pid() {
        // Spawn a quick child, capture its PID, wait for exit, then probe.
        let mut child = Command::new("sh")
            .arg("-c")
            .arg("exit 0")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn sh");
        let pid = child.id();
        let _ = child.wait();
        // Tiny delay to let the kernel fully reap; on macOS the process
        // becomes a zombie until reaped, after which kill returns ESRCH.
        std::thread::sleep(std::time::Duration::from_millis(50));
        assert!(!is_alive(pid));
    }
}
