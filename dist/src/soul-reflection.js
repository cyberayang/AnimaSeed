import { SoulRepository } from './soul-repository.js';
import { authorLife, ancestry } from './soul-life.js';
import { growthSample, growthReview } from './soul-growth-evidence.js';
import { development } from './soul-development.js';
import * as v from './validation.js';
import * as sv from './soul-validation.js';
import { intend, intentionInput, intentions } from './soul-agency.js';
export function reflectionInput(repo, now) {
    const episodes = repo.store.db.prepare(`SELECT n.data FROM nodes n JOIN soul_queue q ON n.id=q.id
    WHERE q.done=0 AND n.status!='forgotten' ORDER BY n.at,n.rowid LIMIT 24`).all()
        .map(x => JSON.parse(x.data));
    const reviewed = new Set(repo.list('growth-review', 10000).map(x => x.details.sampleId));
    const candidates = repo.list('growth-sample', 1000).filter(x => !reviewed.has(x.id)
        && Date.parse(now) - Date.parse(x.at) >= 2 * 86400000).slice(0, 2);
    return { lifecycle: repo.lifecycle(), development: development(repo, now), episodes,
        current: [...repo.current('continuity', 1), ...intentions(repo, now, 4).map(x => ({ ...x.intention,
                details: { ...x.intention.details, authorization: x.authorization } })), ...repo.list('permission', 3), ...repo.list('experience', 3),
            ...repo.current('understanding', 8), ...repo.current('interest', 5),
            ...repo.current('preference', 5), ...repo.list('choice', 5), ...repo.list('feedback', 5)],
        reviewCandidates: candidates,
        reviewEvidence: candidates.map(sample => {
            const roots = ancestry(repo, sample.citations);
            return { sampleId: sample.id, entries: roots.entries, episodes: roots.memories };
        }) };
}
export function applyReflection(repo, value, input, now) {
    const proposal = v.object(value), entries = v.list(proposal.entries ?? [], 12).map(sv.lifeInput);
    const requested = v.list(proposal.intentions ?? [], 3).map(intentionInput);
    const growth = v.list(proposal.growth ?? [], 3).map(sv.sampleInput);
    const reviews = v.list(proposal.reviews ?? [], 4).map(sv.reviewInput);
    const allowedReviews = new Set(input.reviewCandidates.map(x => x.id));
    if (reviews.some(x => !allowedReviews.has(x.sampleId)))
        throw new Error('只能复核本轮提供的、已间隔两天的既有候选');
    const result = { entries: entries.map(x => authorLife(repo, x, now)), growth: growth.map(x => growthSample(repo, x, now)),
        reviews: reviews.map(x => growthReview(repo, x, now)), intentions: requested.map(x => intend(repo, x, now)) };
    for (const episode of input.episodes)
        repo.store.db.prepare('UPDATE soul_queue SET done=1 WHERE id=?').run(episode.id);
    return result;
}
