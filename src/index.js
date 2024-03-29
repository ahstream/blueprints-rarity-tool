import _ from 'lodash';

import * as collection from './collection.js';
import { getConfig } from './config.js';

function component() {
  const element = document.createElement('div');
  element.innerHTML = _.join(['Hello', 'webpack2'], ' ');
  return element;
}

document.body.appendChild(component());

const config = getConfig({
  'collectionId': 'nfteams',
  'sleepBetweenReveal': 500,
  'revealTokenIds': [10, 296, 452, 526, 789, 1234, 2345, 3456],
  'fetchTokenOptions': { 'concurrent': 100, 'sleepBetweenBatches': 100, 'timeout': 5000 },
  'supply': [10000],
  'contractAddress': '0x03f5cee0d698c24a42a396ec6bdaee014057d4c8',
  'unrevealedImage': null,
  'rules': {
    'normalize': false,
    'traitCount': false,
    'additionalWeight': true,
    'weights': {
      'Shield': 0,
      'Animated': 2,
      'Eyes': 1,
      'Ears': 1,
      'Background': 1,
      'Character': 1,
      'Colour': 1
    },
    'customTraits': {
      'Clothes/Robot': 'Animated/Yes'
    },
    'validationTraits': {
      'Character': true
    }
  },
  'alert': {
    'floorMargin': 0.02,
    'traits': [
      { 'key': 'Character: Hydra', 'floorFactor': 6000 },
      { 'key': 'Character: Boredape', 'floorFactor': 6 },
      { 'key': 'Character: Zeus', 'floorFactor': 4 },
      { 'key': 'Character: Panda', 'floorFactor': 1 },
      { 'key': 'Character: Minotaur', 'floorFactor': 1 },
      { 'key': 'Background: Sponsor', 'floorFactor': 2 },
      { 'key': 'Clothes: Suit', 'floorFactor': 1.5 },
      { 'key': 'Clothes: Robot', 'floorFactor': 3 },
      { 'key': 'Colour: Gold', 'floorFactor': 4 },
      { 'key': 'Head: Green NFTeams Hat', 'floorFactor': 1.5 },
      { 'key': 'Head: Black NFTeams Hat', 'floorFactor': 1.5 },
      { 'key': 'Head: Eth Crown', 'floorFactor': 4 },
      { 'key': 'Head: Bitcoin Crown', 'floorFactor': 4 },
      { 'key': 'Mouth: Fire Breath', 'floorFactor': 1.5 },
      { 'key': 'Mouth: Black Mask', 'floorFactor': 2 },
      { 'key': 'Mouth: Gold Teeth', 'floorFactor': 2 }
    ],
    'traits2': [
      { 'key': 'Character/Alien', 'floorFactor': 1 },
      { 'key': 'Character/Apes', 'floorFactor': 1 },
      { 'key': 'Character/Hydra', 'floorFactor': 6000 },
      { 'key': 'Character/Boredape', 'floorFactor': 6 },
      { 'key': 'Character/Zeus', 'floorFactor': 4 },
      { 'key': 'Character/Panda', 'floorFactor': 1 },
      { 'key': 'Character/Minotaur', 'floorFactor': 1 },
      { 'key': 'Background/Sponsor', 'floorFactor': 2 },
      { 'key': 'Clothes/Suit', 'floorFactor': 1 },
      { 'key': 'Clothes/Robot', 'floorFactor': 3 },
      { 'key': 'Colour/Gold', 'floorFactor': 4 },
      { 'key': 'Head/Green NFTeams Hat', 'floorFactor': 1 },
      { 'key': 'Head/Black NFTeams Hat', 'floorFactor': 1 },
      { 'key': 'Head/Eth Crown', 'floorFactor': 2 },
      { 'key': 'Head/Bitcoin Crown', 'floorFactor': 2 },
      { 'key': 'Mouth/Fire Breath', 'floorFactor': 1 },
      { 'key': 'Mouth/Black Mask', 'floorFactor': 1 },
      { 'key': 'Mouth/Gold Teeth', 'floorFactor': 1 }
    ],
    'ranks': [
      { 'maxRank': 100, 'floorFactor': 2 }
    ]
  },
});

collection.fetch(config);

