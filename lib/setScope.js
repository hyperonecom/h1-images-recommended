'use strict';
const api_servers = {
    'rbx': 'https://api.rootbox.com/v1'
};

module.exports = (client, env) => {
    const scope = (env.SCOPE || 'H1').toLowerCase();
    if (scope !== 'h1') {
        client.basePath = api_servers[scope];
    }
    client.authentications['ServiceAccount'].apiKey = env[`${scope.toUpperCase()}_TOKEN`];
};