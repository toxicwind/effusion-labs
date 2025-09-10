#!/bin/bash
#
# Lists files with intelligent, content-aware details for specific types.
# It extracts titles from Markdown/11ty files and keys from JSON files,
# and attempts to fix common JSON errors before analysis.
#
# USAGE:
#   ./lskind_v2.sh           # Prints a formatted report to the console
#   ./lskind_v2.sh report.txt # Saves the report to report.txt

# Redirect all output. If an argument ($1) is given, output to that file.
# Otherwise, output to standard output (/dev/stdout).
exec > "${1:-/dev/stdout}"

# Add a header with a new "Details" column
printf "%-45s %-14s %-10s %s\n" "File Path" "[Kind]" "Size" "Details"
printf "%s\n" "-----------------------------------------------------------------------------------------------------------"

# Use 'fd' to find all files and pipe them into the processing loop
fd --type f --print0 . | sort -z | while IFS= read -r -d "" f; do
    kind="other"
    details="" # <-- Will hold our dynamic info

    # 1. Initial classification based on path/extension (this is fast)
    case "$f" in
        ./src/_data/*)                kind="global-data" ;;
        *.11tydata.js)                kind="11tydata" ;;
        *.11ty.js)                    kind="11ty-tpl" ;;
        *.njk)                        kind="njk" ;;
        *.md)                         kind="md" ;;
        ./src/assets/js/*)            kind="client-js" ;;
        ./src/styles/*|./src/assets/css/*) kind="css" ;;
        *.jsonl)                      kind="jsonl" ;;
        *.json)                       kind="json" ;;
        *.sh)                         kind="shell" ;;
        ./bin/*)                      kind="executable" ;;
    esac

    # 2. Dynamic inspection based on the 'kind' to get useful details
    case "$kind" in
        "md" | "njk")
            # For Markdown/Nunjucks, find a title.
            # It first checks for a 'title:' in YAML frontmatter. If not found,
            # it falls back to the first H1 heading (e.g., # My Title).
            # Using 'read' with process substitution is safer than 'xargs'
            # and prevents errors with quotes in titles.
            read -r title < <(awk '
                /^---$/ { in_frontmatter = !in_frontmatter; next }
                in_frontmatter && /^\s*title:/ { sub(/^\s*title:\s*/, ""); gsub(/"/, ""); print; exit }
                !in_frontmatter && /^# / { sub(/^# /, ""); print; exit }
            ' "$f")

            if [ -n "$title" ]; then
                details="Title: $title"
            fi
            ;;
        "json" | "global-data")
            # For JSON files, list the top-level keys for a quick summary.
            # This requires 'jq' to be installed.
            if command -v jq &> /dev/null; then
                # FIX: Attempt to repair common JSON errors (like trailing commas)
                # with 'sed' before parsing with 'jq'. This makes the script more robust.
                repaired_json=$(sed 's/,\s*\([}\]]\)/\1/g' "$f")
                keys=$(echo "$repaired_json" | jq -r 'if type == "object" then keys_unsorted | join(", ") else "" end' 2>/dev/null)
                
                if [ -n "$keys" ]; then
                    # Truncate long key lists to keep the output clean
                    if (( ${#keys} > 50 )); then
                        keys="${keys:0:47}..."
                    fi
                    details="Keys: $keys"
                else
                    # This now correctly identifies truly invalid or non-object JSON files.
                    details="(Invalid or non-object JSON)"
                fi
            else
                details="(jq not found for analysis)"
            fi
            ;;
    esac

    # Get file size in bytes
    size=$(wc -c < "$f" | xargs)

    # Print the final formatted output
    printf "%-45s [%-12s] %8sB   %s\n" "$f" "$kind" "$size" "$details"
done

