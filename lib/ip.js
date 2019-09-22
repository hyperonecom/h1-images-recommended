'use strict';
const IP_API_URL = 'https://api.ipify.org?format=json';

const superagent = require('superagent');

const getIp = () => superagent.get(IP_API_URL).then(resp => resp.body.ip);

module.exports = {
    getIp,
};
