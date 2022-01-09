import _ from 'lodash';

import { log } from './myLogger.js';
import * as myUtils from './myUtils.js';
import * as myWeb2 from './myWeb2.js';

let numUsers = 0;

export async function fetch(uriList, callback, context, fetchOptions) {
  numUsers++;

  fetchOptions.retryTo = fetchOptions.retryForSeconds ? myUtils.addSecondsToDate(new Date(), fetchOptions.retryForSeconds) : null;
  log.info(`Fetch URIs, numUsers: ${numUsers} retryTo: ${fetchOptions.retryTo}`);

  const input = [...uriList];
  const active = [];

  while (input.length > 0 || active.length > 0) {
    const maxConcurrent = fetchOptions.maxConcurrent / numUsers;
    const maxNumNew = active.length < maxConcurrent ? maxConcurrent - active.length : 0;
    log.info(`URI requests left: ${input.length}, Active: ${active.length}, MaxNew: ${maxNumNew}`);
    const uriItems = input.splice(0, maxNumNew);

    for (const item of uriItems) {
      fetchOne(item, active, callback, context, fetchOptions);
    }

    await myUtils.delay(fetchOptions.batchDelay);
  }

  numUsers--;

  log.info('Done with URIs fetch!');
  return true;
}

async function fetchOne(item, active, callback, context, fetchOptions, attempt = 1) {
  if (attempt === 1) {
    // Only push to active for first attempt, otherwise it would contain duplicates for retries!
    active.push(item);
  }

  let result;
  if (!fetchOptions.retryTo || fetchOptions.retryTo >= new Date()) {
    const response = await myWeb2.get(item.uri, { timeout: fetchOptions.timeout }, true);
    result = callback(item, response, context, fetchOptions);
  } else {
    // Use dummy response to signal no more retries!
    const response = { status: -1 };
    result = callback(item, response, context, fetchOptions);
  }

  if (result.retry) {
    setTimeout(() => fetchOne(item, active, callback, context, fetchOptions, attempt + 1), result.delay);
    return;
  }

  // otherwise we are finished and remove item from active.
  _.remove(active, obj => obj.uri === item.uri);

  log.debug('Active requests:', active.length);
  if (active.length <= 5) {
    log.debug('Active requests:', active);
  }
}
