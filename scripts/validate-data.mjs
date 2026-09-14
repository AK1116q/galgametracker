import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync(new URL('../schemas/route-pack.schema.json', import.meta.url), 'utf8'));
const checkSchema = new Ajv({ allErrors: true, strict: true }).compile(schema);

export function validatePack(pack) {
  if (!checkSchema(pack)) {
    return checkSchema.errors.map(e => `${e.instancePath || '/'} ${e.message}`);
  }
  const errors = [];
  function index(items, label) {
    const result = new Map();
    for (const item of items) {
      if (result.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
      result.set(item.id, item);
    }
    return result;
  }
  const routes = index(pack.routes, 'routes');
  const choices = index(pack.choices, 'choices');
  const endings = index(pack.endings, 'endings');
  const sources = index(pack.sources, 'sources');
  const options = new Map(pack.choices.map(c => [c.id, index(c.options, `choice ${c.id} options`)]));
  const ref = (map, id, label) => {
    if (!map.has(id)) errors.push(`${label}: unknown reference ${id}`);
  };
  function condition(c) {
    if (c.all) c.all.forEach(condition);
    if (c.any) c.any.forEach(condition);
    if (c.choiceId) {
      ref(choices, c.choiceId, 'condition choice');
      ref(options.get(c.choiceId) ?? new Map(), c.optionId, 'condition option');
    }
    if (c.endingId) ref(endings, c.endingId, 'condition ending');
  }
  for (const route of pack.routes) {
    ref(choices, route.entryChoiceId, 'route entry');
    route.requiredEndingIds.forEach(id => ref(endings, id, 'route prerequisite'));
  }
  for (const choice of pack.choices) {
    for (const option of choice.options) {
      ref(option.next.kind === 'choice' ? choices : endings, option.next.id, 'option destination');
    }
    for (const rule of choice.rules) {
      ref(routes, rule.routeId, 'rule route');
      ref(sources, rule.sourceId, 'rule source');
      rule.recommendedOptionIds.forEach(id => ref(options.get(choice.id), id, 'recommended option'));
      condition(rule.when);
    }
  }
  for (const review of pack.reviews) {
    review.routeIds.forEach(id => ref(routes, id, 'review route'));
    const date = new Date(`${review.date}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== review.date) {
      errors.push(`review date: invalid date ${review.date}`);
    }
  }
  const hasSyntheticSource = pack.sources.some(s => s.kind === 'synthetic');
  if (!pack.synthetic && hasSyntheticSource) errors.push('real pack cannot contain synthetic sources');
  if (pack.synthetic && pack.status !== 'draft') errors.push('synthetic pack must remain draft');
  if (pack.status === 'verified') {
    const covered = new Set(pack.reviews.flatMap(r => r.routeIds));
    for (const route of pack.routes) {
      if (!covered.has(route.id)) errors.push(`verified pack requires review for ${route.id}`);
    }
  }
  return errors;
}

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : entry.name.endsWith('.route.json') ? [path] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (!files.length) files.push(...filesIn(fileURLToPath(new URL('../data', import.meta.url))));
  if (!files.length) {
    console.error('No route data found');
    process.exitCode = 1;
  }
  for (const file of files) {
    try {
      const errors = validatePack(JSON.parse(readFileSync(file, 'utf8')));
      if (errors.length) {
        console.error(`${file}\n${errors.join('\n')}`);
        process.exitCode = 1;
      } else console.log(`OK ${file}`);
    } catch (error) {
      console.error(`${file}: ${error.message}`);
      process.exitCode = 1;
    }
  }
}
