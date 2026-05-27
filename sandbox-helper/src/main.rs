use std::env;
use std::ffi::CString;
use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use landlock::{
    Access, AccessFs, CompatLevel, Compatible, PathBeneath, PathFd, Ruleset, RulesetAttr,
    RulesetCreatedAttr, ABI,
};
use nix::sched::{unshare, CloneFlags};
use nix::unistd::{execvp, getgid, getuid};

const REQUESTED_ABI: ABI = ABI::V5;

fn main() -> Result<()> {
    let args: Vec<String> = env::args().collect();

    if args.iter().any(|arg| arg == "--probe") {
        println!("landlock={}", if probe_landlock() { "ok" } else { "no" });
        return Ok(());
    }

    let command = args
        .get(1)
        .context("usage: totvibe-sandbox <command> (or --probe)")?
        .clone();

    if env::var("SANDBOX_NET").unwrap_or_else(|_| "none".into()) == "none" {
        if let Err(error) = isolate_network() {
            eprintln!("[sandbox] network isolation unavailable: {error:#}");
        }
    }

    let readonly = split_paths(env::var("SANDBOX_RO_PATHS").unwrap_or_default());
    let readwrite = split_paths(env::var("SANDBOX_RW_PATHS").unwrap_or_default());
    if let Err(error) = apply_landlock(&readonly, &readwrite) {
        eprintln!("[sandbox] filesystem restrictions degraded: {error:#}");
    }

    let bash = CString::new("/bin/bash")?;
    let dash_c = CString::new("-c")?;
    let command = CString::new(command)?;
    execvp(&bash, &[bash.clone(), dash_c, command]).context("exec /bin/bash failed")?;
    unreachable!("execvp replaces the process on success");
}

fn split_paths(value: String) -> Vec<String> {
    value
        .split(':')
        .filter(|entry| !entry.is_empty())
        .map(str::to_string)
        .collect()
}

fn probe_landlock() -> bool {
    Ruleset::default()
        .set_compatibility(CompatLevel::BestEffort)
        .handle_access(AccessFs::from_all(REQUESTED_ABI))
        .and_then(|ruleset| ruleset.create())
        .is_ok()
}

fn isolate_network() -> Result<()> {
    let uid = getuid().as_raw();
    let gid = getgid().as_raw();
    unshare(CloneFlags::CLONE_NEWUSER | CloneFlags::CLONE_NEWNET)
        .context("unshare(CLONE_NEWUSER | CLONE_NEWNET)")?;
    let _ = fs::write("/proc/self/setgroups", "deny");
    fs::write("/proc/self/uid_map", format!("0 {uid} 1\n")).context("write uid_map")?;
    fs::write("/proc/self/gid_map", format!("0 {gid} 1\n")).context("write gid_map")?;
    Ok(())
}

fn apply_landlock(readonly: &[String], readwrite: &[String]) -> Result<()> {
    let mut ruleset = Ruleset::default()
        .set_compatibility(CompatLevel::BestEffort)
        .handle_access(AccessFs::from_all(REQUESTED_ABI))?
        .create()?;

    for path in readonly {
        if !Path::new(path).exists() {
            continue;
        }
        let fd = PathFd::new(path).with_context(|| format!("open {path}"))?;
        ruleset = ruleset.add_rule(PathBeneath::new(fd, AccessFs::from_read(REQUESTED_ABI)))?;
    }

    for path in readwrite {
        if !Path::new(path).exists() {
            continue;
        }
        let fd = PathFd::new(path).with_context(|| format!("open {path}"))?;
        ruleset = ruleset.add_rule(PathBeneath::new(fd, AccessFs::from_all(REQUESTED_ABI)))?;
    }

    ruleset.restrict_self().context("landlock restrict_self")?;
    Ok(())
}
