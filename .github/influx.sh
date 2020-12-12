#!/bin/bash
set -e

ts=$(date +"%s");

if [[ -z "$SCOPE" ]]; then
    echo "Missing variable for SCOPE"; 
    exit 1;
fi;

if [[ -z "$CONFIG" ]]; then
    echo "Missing variable for CONFIG"; 
    exit 1;
fi;

if [[ -z "$INFLUXDB_VALUE" ]]; then
    echo "Missing variable for INFLUXDB_VALUE"; 
    exit 1;
fi;

if [[ -z "$INFLUXDB_VALUE" ]]; then
    echo "Missing variable for INFLUXDB_VALUE"; 
    exit 1;
fi;

tags=$(jq -nr --arg a "${GITHUB_REPOSITORY}" --arg b "${GITHUB_EVENT_NAME}" --arg c "${CONFIG} -arg d "${SCOPE} '[$a|@uri,$b|@uri,$c|@uri,$d|@uri] | join(",")')
values=$(jq -nr --arg a "${GITHUB_SHA}" --arg b "${GITHUB_RUN_NUMBER}" --arg c "${INFLUXDB_VALUE}" '[$a|@uri,$b|@uri,$c|@uri] | join(",")')
exec curl -XPOST "http://${INFLUXDB_USER}:${INFLUXDB_PASSWORD}@${INFLUXDB_HOST}/write?db=actions&precision=s" --data-raw "build,${tags} ${values} $ts"
