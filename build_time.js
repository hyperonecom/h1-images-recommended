'use strict';

const superagent = require('superagent');
const agent = superagent.agent();

const repository_slug = 'hyperonecom/h1-images-recommended';

const fetch_build_detail = async build_id => {
    const resp = await agent.get(`https://api.travis-ci.com/repos/${repository_slug}/builds/${build_id}`).set({
        Accept: 'application/vnd.travis-ci.2.1+json',
    });
    const started_at = Math.min.apply(null, resp.body.jobs.map(x => new Date(x.started_at)));
    const finished_at = Math.max.apply(null, resp.body.jobs.map(x => new Date(x.finished_at)));
    const duration_min = (finished_at - started_at) / 1000 / 60;
    return {
        repository_slug,
        build_id,
        started_at: new Date(started_at),
        finished_at: new Date(finished_at),
        duration_min: started_at == 0 ? NaN : duration_min,
    };
};

const fetch_build_list = async () => {
    const resp = await agent.get(`https://api.travis-ci.com/repos/${repository_slug}/builds`).set({
        Accept: 'application/vnd.travis-ci.2.1+json',
    });
    return resp.body.builds;
};


const main = async () => {
    let prev = 0;
    for (const { id } of await fetch_build_list()) {
        const build = await fetch_build_detail(id);
        if (build.started_at == 0) {
            continue;
        }
        console.log({
            ...build,
            delta_min: build.duration_min - prev,
        });
        prev = build.duration_min;
    }
};

main().catch(console.error);