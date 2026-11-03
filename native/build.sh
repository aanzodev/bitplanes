#!/bin/sh
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -O3 -nostdlib -fno-builtin-memset \
    -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=1048576 -Wl,--max-memory=67108864 \
    -o ../js/airbattle/erosion.wasm erosion.c
echo "Built js/airbattle/erosion.wasm ($(wc -c < ../js/airbattle/erosion.wasm) bytes)"
