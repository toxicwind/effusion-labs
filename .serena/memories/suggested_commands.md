Suggested commands for /home/toxic project

- Start discovery import headless:
  - `systemctl --user start de-effusion.service` (runs headless)
- Run interactively for debug:
  - `QUIET=0 bash -x /home/toxic/bin/de_effusion_end2end.sh`
- Inspect service status:
  - `systemctl --user status de-effusion.service`
- Query operation status:
  - `gcloud auth print-access-token | xargs -I{} curl -H "Authorization: Bearer {}" <OP_URL>`
- GCS operations with gsutil:
  - `gsutil ls gs://<bucket>`
- Serena: daemon actions managed by Serena MCP; use `tmux` lanes: scan, donors, build, test, ship, logs.
