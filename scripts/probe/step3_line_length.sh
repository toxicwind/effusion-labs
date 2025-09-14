#!/bin/bash
set -euo pipefail
out_dir="var/exec_probe"
mkdir -p "$out_dir"
# header
echo -e "size\tconsole_sample_len\tfile_len" > "$out_dir/line_length_summary.tsv"
for S in 1024 2048 3072 3500 3800 5000; do
  python3 - <<PY | tee >(cat > "$out_dir/full_S${S}.txt") | cut -b1-200 | tee "$out_dir/console_S${S}.txt"
print("X"*${S})
PY
  console_len=$(wc -c < "$out_dir/console_S${S}.txt")
  file_len=$(wc -c < "$out_dir/full_S${S}.txt")
  echo -e "${S}\t${console_len}\t${file_len}" >> "$out_dir/line_length_summary.tsv"
done
