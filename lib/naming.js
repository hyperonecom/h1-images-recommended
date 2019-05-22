module.exports = {

    qcow: (config) => {
        const parts = [
            config.distro,
            config.version.replace('.', '')
        ];
        if (config.edition !== 'server') {
            parts.push(config.edition)
        }
        return `${parts.join("-")}.json`;
    }
}
