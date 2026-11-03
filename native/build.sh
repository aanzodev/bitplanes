#!/bin/sh
# Builds the C parts of Bit Planes into WebAssembly for the browser.
# Needs clang and wasm-ld (LLVM 15 or newer). The built .wasm files are
# committed, so you only need this if you change the C code.
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -O3 -nostdlib -fno-builtin-memset \
    -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=1048576 -Wl,--max-memory=67108864 \
    -o ../js/airbattle/erosion.wasm erosion.c
echo "Built js/airbattle/erosion.wasm ($(wc -c < ../js/airbattle/erosion.wasm) bytes)"
