import { getCollectionStatsAndRetry } from './hlib/opensea.js';

/**
 * Copyright (c) 2021
 * FILE DESCRIPTION
 */

require('./initNodeApp.js');

const { program } = require('commander');
const config = require('../config/config.json');

import * as collection from './collection.js';
import * as debug from './hlib/debug.js';
import { log } from './hlib/logger.js';
import * as openseaHelpers from './hlib/openseaHelpersSafe.js';
import * as webpage from './webpage.js';

// RUNTIME ----------------------------------------------------------------------------------

run();

// MAIN FUNCTIONS ----------------------------------------------------------------------------------

async function run() {
  log.info('run program');

  // program.option('--id <value>', 'Project ID', '');
  program.option('--debug', 'Write debug info');
  program.option('--all', 'Output all items instead of only buynow items');
  program.option('--nodb', 'Do not get data from DB');
  program.option('--silent', 'Do not notify events');
  program.option('--skippagenums', '');
  program.option('--sample', 'Use test samples');
  program.option('--skiptokencache', '');
  program.option('--skipopensea', '');
  program.option('--top <value>', 'Top N tokens instead of Buynow tokens');
  program.option('--id <value>', 'Token Id');
  program.option('--contract <value>', 'Contract address');
  program.parse();

  const options = program.opts();
  const cmd = program.args[0];
  const projectId = program.args[1];

  log.info(`cmd: ${cmd}, projectId: ${projectId}, options: ${JSON.stringify(options)}`);
  log.info('------------------------------------------------');

  let result;

  switch (cmd) {
    case 'chart':
      const data = [
        { x: new Date('2007-04-01'), y: 93.24 },
        { x: new Date('2007-04-02'), y: 91.35 },
        { x: new Date('2007-04-03'), y: 75.35 },
        { x: new Date('2007-04-04'), y: 93.24 },
        { x: new Date('2007-04-05'), y: 91.35 },
        { x: new Date('2007-04-06'), y: 75.35 },
        { x: new Date('2007-04-07'), y: 75.35 },
        { x: new Date('2007-04-08'), y: 75.35 },
        { x: new Date('2007-04-09'), y: 75.35 },
        { x: new Date('2007-04-10'), y: 75.35 },
      ];
      await webpage.chartTest(data);
      break;
    case 'test':
      await webpage.test();
      break;
    case 'grifters':
      await collection.grifters(config);
      break;
    case 'griftersgonnaclaim':
      webpage.writeGriftersGonnaClaim(config);
      break;
    case 'poll':
      result = await collection.poll(config);
      console.log(result);
      break;
    case 'asyncart':
      result = await asyncart(config);
      // console.log(result);
      break;
    case 'os10':
      console.log(await openseaHelpers.getCollectionStats('async-blueprints'));
      break;
    case 'os11':
      console.log(await openseaHelpers.getCollectionStatsWithRetry('nfteams-club'));
      break;
    case 'os20':
      console.log(await openseaHelpers.getContract('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8'));
      break;
    case 'os21':
      console.log(await openseaHelpers.getContractWithRetry('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8'));
      break;
    case 'os30':
      console.log(await openseaHelpers.getAsset('0xc143bbfcdbdbed6d454803804752a064a622c1f3', '1000'));
      break;
    case 'os31':
      console.log(await openseaHelpers.getAssetWithRetry('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8', '1485'));
      break;
    case 'os40':
      result = await openseaHelpers.getAssets('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8');
      console.log(result[0]);
      console.log(result.length);
      break;
    case 'os41':
      result = await openseaHelpers.getAssets('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8');
      console.log(result[0]);
      console.log(result.length);
      break;
    case 'os50':
      result = await openseaHelpers.getAssetsBlock('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8', 200, 0);
      console.log(result[0]);
      console.log(result.length);
      break;
    case 'os51':
      result = await openseaHelpers.getAssetsBlockWithRetry('0x03f5cee0d698c24a42a396ec6bdaee014057d4c8', 200, 0);
      console.log(result[0]);
      console.log(result.length);
      break;
    case 'os60':
      console.log(await openseaHelpers.getCollectionFloor('nfteams-club'));
      break;
    case 'os61':
      console.log(await openseaHelpers.getCollectionFloorWithRetry('nfteams-club'));
      break;
    case 'event':
      result = await openseaHelpers.getEvents('0xc143bbfcdbdbed6d454803804752a064a622c1f3');
      console.log(result.map(obj => obj.listing_price));
      debug.debugToFile(result, 'events');
      break;
    case 'event2':
      result = await openseaHelpers.getEventBlockWithRetry('0xc143bbfcdbdbed6d454803804752a064a622c1f3', 50, 3900);
      console.log(result);
      console.log(result.map(obj => obj.listing_price));
      console.log(result.length);
      debug.debugToFile(result, 'events');
      break;
    default:
      log.error(`Unknown command: ${cmd}`);
  }
}
