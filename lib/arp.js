'use strict';

const runProcess = require('./runProcess');
const path = require('path');

module.exports = {
    clean: () => runProcess(path.join(__dirname, 'arp_clean.sh')),
};
