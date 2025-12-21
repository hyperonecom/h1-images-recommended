#!/bin/sh
# Avoid "Error writing to file" due "No space left on device"
# This script checks the used disk space percentage for the root filesystem (/).
# It is designed to be compatible with various Linux distributions and FreeBSD.

set -e

df_output=$(df -k /)
USED=$(echo "$df_output" | awk 'NR==2 {print $3}')
SIZE=$(echo "$df_output" | awk 'NR==2 {print $2}')

if [ "$SIZE" -gt 0 ]; then
    USED_PERCENT=$(( 100 * USED / SIZE ))
else
    USED_PERCENT=0
fi

echo "Size: ${SIZE} Used space: ${USED} (${USED_PERCENT}%)"

# Exit with success if used space is less than 90%, failure otherwise.
[ "$USED_PERCENT" -lt 90 ]
