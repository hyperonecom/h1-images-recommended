'use strict';

module.exports = (time) => new Promise(resolve => {
    console.log(`Delay ${time / 1000} seconds`);
    return setTimeout(resolve, time);
});
