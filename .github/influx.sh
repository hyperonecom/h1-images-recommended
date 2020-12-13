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

function encode(){
    jq -nr --arg a "${1}" '$a|@uri';
}

github_repository=$(encode "$GITHUB_REPOSITORY");
config=$(encode "$CONFIG");
scope=$(encode "$SCOPE");
data="build,github_repository=${github_repository},github_event_name=${GITHUB_EVENT_NAME},config=$config,scope=$SCOPE github_sha=\"$GITHUB_SHA\",github_run_number=\"$GITHUB_RUN_NUMBER\",value=$INFLUXDB_VALUE ${ts}"
exec curl -XPOST "http://${INFLUXDB_USER}:${INFLUXDB_PASSWORD}@${INFLUXDB_HOST}/write?db=recommended_image&precision=s" --data-raw "$data";
