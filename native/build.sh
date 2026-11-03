#!/bin/sh
set -e
cd "$(dirname "$0")"
clang --target=wasm32 -O3 -nostdlib -fno-builtin-memset \
    -Wl,--no-entry -Wl,--export-dynamic -Wl,--initial-memory=1048576 -Wl,--max-memory=67108864 \
    -o ../js/airbattle/erosion.wasm erosion.c
echo "Built js/airbattle/erosion.wasm ($(wc -c < ../js/airbattle/erosion.wasm) bytes)"
clang++ --target=wasm32 -O3 -std=c++17 -nostdlib -fno-exceptions -fno-rtti \
    -Wall -Wextra -Werror \
    -Wl,--no-entry -Wl,--export=fm_params,--export=fm_slots,--export=fm_calibrate,--export=fm_step,--export=fm_stall_speed \
    -Wl,--export-memory -Wl,--initial-memory=131072 -Wl,--max-memory=131072 \
    -o ../js/airbattle/flight.wasm flight.cpp
echo "Built js/airbattle/flight.wasm ($(wc -c < ../js/airbattle/flight.wasm) bytes)"
