#!/bin/bash
# Avoid "Error writing to file" due "No space left on device"
[ $(df / --output="pcent"  | sed -e 1d -e 's/%//g') -lt 90 ]