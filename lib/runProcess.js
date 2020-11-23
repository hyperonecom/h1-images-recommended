'use strict';
const { spawn } = require('child_process');

module.exports = (cmd, args = [], opts = {}) => new Promise((resolve, reject) => {
    const env = opts.env || {};
    const catch_stderr = opts.stderr === undefined ? true : opts.stderr;
    const proc = spawn(cmd, args, {
        env: { ...process.env, ...env },
        stdio: [null, 'pipe', 'pipe'],
    });
    let output = '';

    proc.on('close', (code) => {
        if (code !== 0) {
            const error = new Error(`Process exited with code ${code}`);
            error.code = code;
            if (opts.catchOutput) {
                error.output = output;
            }
            return reject(error);
        }
        return resolve(output);
    });

    proc.stdout.on('data', (data) => {
        for (const line of data.toString('utf-8').split('\n')) {
            console.log(`${cmd}:STDOUT:${line}`);
        }
        output += data;
    });
    if (catch_stderr) {
        proc.stderr.on('data', (data) => {
            for (const line of data.toString('utf-8').split('\n')) {
                console.log(`${cmd}:STDERR:${line}`);
            }
            output += data;
        });
    }
});
