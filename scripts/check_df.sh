#!/bin/bash
# Avoid "Error writing to file" due "No space left on device"
# 'df / --output="pcent"' is not busybox compatible
USED=$(df / -P -a | awk 'FNR==2{print $3}')
AVAILABLE=$(df / -P -a | awk 'FNR==2{print $4}')
PCENT=$(( $USED*100/$AVAILABLE ))
[ $PCENT -lt 90 ]