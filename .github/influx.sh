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

if [[ -z "$INFLUXDB_ATTEMPT" ]]; then
    echo "Missing variable for INFLUXDB_ATTEMPT";
    exit 1;
fi;


function encode(){
    jq -nr --arg a "${1}" '$a|@uri';
}

github_repository=$(encode "$GITHUB_REPOSITORY");
config=$(basename "$CONFIG");
scope=$(encode "$SCOPE");
ref=$(encode "$GITHUB_REF");
attempt=$(encode "$INFLUXDB_ATTEMPT");
data="build,github_repository=${github_repository},github_ref=${ref},github_event_name=${GITHUB_EVENT_NAME},config=$config,scope=$SCOPE,attempt=$attempt github_sha=\"$GITHUB_SHA\",github_run_number=\"$GITHUB_RUN_NUMBER\",value=$INFLUXDB_VALUE ${ts}"
exec curl -XPOST "http://${INFLUXDB_USER}:${INFLUXDB_PASSWORD}@${INFLUXDB_HOST}/write?db=recommended_image&precision=s" --data-raw "$data";
