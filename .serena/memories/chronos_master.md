Project: /home/toxic (toxic-home)
Purpose: orchestration and tooling for antigravity-compare; Discovery Engine import/search end-to-end test harness.
Tech stack: Python, Bash, Node.js, Rust crates, Docker, systemd user services, Google Cloud SDK (gcloud/gsutil), tmux.
Structure: multi-repo workspace with folders: workspace/, antigravity-compare/, github-advanced-search-mcp/, toxic/.
Essential commands: `gcloud`, `gsutil`, `bash de_effusion_end2end.sh`, `systemctl --user`, `rg`, `fd`, `jq`.
Developer notes: Use `--quiet`/`CLOUDSDK_CORE_DISABLE_PROMPTS=1` for headless runs; use `QUIET=0` for interactive debug; Serena manages tmux lanes and .chronos state.
