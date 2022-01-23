import open from 'open';
import { compileFile } from 'pug';
import TableBuilder from 'table-builder';

import { lineChartScriptHtml } from './d3Chart.js';
import { ensureFolder, writeFile } from './hlib/fileutils.js';
import { log } from './hlib/logger.js';
import { compareOrderedNum, compareOrderedString } from './hlib/utils.js';

const path = require('path');

const IMAGE_NOT_FOUND_URL = 'https://www.publicdomainpictures.net/pictures/280000/velka/not-found-image-15383864787lu.jpg';

function rnd() {
  rnd.seed = (rnd.seed * 9301 + 49597) % 533580;
  return rnd.seed / (533580.0);
};

function rand(number) {
  return Math.ceil(rnd() * number);
}

rnd.today = new Date();
rnd.seed = rnd.today.getTime();

const first_phrase = new Array('artless', 'bawdy', 'beslubbering', 'bootless', 'churlish', 'clouted',
  'cockered', 'craven', 'currish', 'dankish', 'dissembling', 'droning', 'errant', 'fawning',
  'fobbing', 'frothy', 'froward', 'gleeking', 'goatish', 'gorbellied', 'impertinent',
  'infectious', 'jarring', 'loggerheaded', 'lumpish', 'mammering', 'mangled', 'mewling',
  'paunchy', 'pribbling', 'puking', 'puny', 'qualling', 'rank', 'reeky', 'roguish', 'ruttish',
  'saucy', 'spleeny', 'spongy', 'surly', 'tottering', 'unmuzzled', 'vain', 'venomed',
  'villainous', 'warped', 'wayward', 'weedy', 'yeasty', 'abominable', 'accursed', 'adulterate', 'arrogant', 'babbling',
  'barbarous', 'base', 'mumbling', 'overwheening', 'perfidious', 'pestilent', 'poisonous', 'pragging', 'rancorous', 'rascally',
  'sanctimonious', 'shameless', 'slanderous', 'soulless', 'spongey', 'crusty', 'withered', 'loathed',
  'tongueless', 'traitorous', 'unwholesome', 'viperous', 'greasy', 'obscene', 'beggarly', 'scandalous', 'creeping',
  'lascivious', 'degenerate', 'meddling');

const second_phrase = new Array('base-court', 'prick-eared', 'puisny-tilted', 'puke-stockinged', 'open-arsed', 'bat-fowling', 'beef-witted', 'beetle-headed',
  'boil-brained', 'clapper-clawed', 'clay-brained', 'common-kissing', 'crook-pated',
  'dismal-dreaming', 'dizzy-eyed', 'doghearted', 'dread-bolted', 'earth-vexing',
  'elf-skinned', 'fat-kidneyed', 'fen-sucked', 'flap-mouthed', 'fly-bitten',
  'folly-fallen', 'fool-born', 'full-gorged', 'guts-griping', 'half-faced', 'hasty-witted',
  'hedge-born', 'hell-hated', 'idle-headed', 'ill-bred', 'ill-nurtured', 'knotty-pated',
  'milk-livered', 'motley-minded', 'onion-eyed', 'plume-plucked', 'pottle-deep',
  'pox-marked', 'reeling-ripe', 'rough-hewn', 'rude-growing', 'rump-fed', 'shard-borne',
  'sheep-biting', 'spur-galled', 'swag-bellied', 'tardy-gaited', 'tickle-brained', 'white-livered',
  'toad-spotted', 'urchin-snouted', 'weather-bitten', 'shag-haired', 'tallow-faced', 'beef-witted',
  'decayed', 'deformed', 'muddy-mottled', 'hag-born', 'long-tongued', 'toad-spotted');

const third_phrase = new Array('baggage', 'barnacle', 'bladder', 'boar-pig', 'bugbear',
  'bum-bailey', 'canker-blossom', 'clack-dish', 'clotpole', 'codpiece', 'coxcomb', 'death-token',
  'dewberry', 'flap-dragon', 'flax-wench', 'flirt-gill', 'foot-licker', 'fustilarian',
  'giglet', 'gudgeon', 'haggard', 'harpy', 'hedge-pig', 'horn-beast', 'hugger-mugger',
  'joithead', 'lewdster', 'lout', 'maggot-pie', 'malt-worm', 'mammet', 'measle', 'minnow',
  'miscreant', 'moldwarp', 'mumble-news', 'nut-hook', 'pigeon-egg', 'pignut', 'pumpion',
  'puttock', 'ratsbane', 'scut', 'skainsmate', 'strumpet', 'varlet', 'vassal', 'wagtail',
  'whey-face', 'scullion', 'serpents-egg', 'callet', 'slug', 'bag of guts', 'punk', 'bitch-wolf', 'botch', 'withered-hag',
  'mangy-dog', 'foul deformity', 'odiferous stench', 'no bowels', 'drunkard', 'turd', 'bear-whelp', 'eunuch',
  'devil-incarnate', 'filthy rogue', 'vile worm', 'writhled shrimp', 'scurvy-knave', 'whore-master', 'malt-horse',
  'varlet', 'worms-meat', 'canker-blossom', 'carrion', 'hag-seed', 'ruinous-butt', 'contriver', 'hypocrite', 'infection',
  'imbossed carbunkle', 'eternal devil', 'execrable-wretch', 'murderous coward', 'foul adulterer', 'ingested-lump', 'wrinkled-witch',
  'plebian', 'strumpet', 'horse-drench', 'promise-breaker', 'incontinent varlet', 'leprous witch', 'babbling gossip',
  'tyrant', 'purified-cur', 'misbegotten-divel', 'mildewed-ear');

function getgetInsult() {
  const rand1 = rand(first_phrase.length) - 1;
  const rand2 = rand(second_phrase.length) - 1;
  const rand3 = rand(third_phrase.length) - 1;

  return 'Thou ' + first_phrase[rand1] + ' ' + second_phrase[rand2] + ' ' + third_phrase[rand3];
}

function randomNotForSalePhrase() {
  const phrases = [
    'I want the finest wines available to humanity!',
    'I feel like a pig shat in my head...',
    'I demand to have some booze!',
    'Black puddings are no good to us!',
    'I\'m going to do the washing up!',
    'I don\'t consciously offend big men like this!',
    'Get any more masculine and you\'d have to live up a tree...',
    'Get that damned little swine out of here!',
    'Yet again that oaf has destroyed my day!',
    'I mean to have you, even if it must be burglary!',
    'Sherry? Oh dear no no...',
    'I\'m preparing myself to forgive you...',
    'I think you\'ve been punished enough...',
    'I used to weep in butchers\' shops...',
    'Go with it. It\'s society\'s crime, not ours...',
    'You\'re looking very beautiful, man. You been away?',
    'I been watching you, especially you...',
    'Please, I don\'t feel good...',
    'So, there\'s this judge sitting there in the cape like fucking Batman...',
    'I could take double anything you could!',
    'How dare you! How dare you!',
    'Where\'s the whiskey?',
    'Where are we?!',
    'Would it be in bad form to plagiarise a toast?',
    'I\'ve got nothing to sell!',
    'What makes you possibly think I\'ve got anything for your pot?',
    'I deny all accusations. What do you want?',
    'I have just finished fighting a naked man!',
    'I think we\'ve been in here too long. I feel unusual.',
    'We can\'t go on like this...',
    'I assure you I\'m not drunk...',
  ];
  return phrases[rand(phrases.length - 1)];
}

export async function writeGrifters(config) {
  const compiledFunction = compileFile('src/templates/grifters.pug');

  const isGrifter = (asset) => asset.description === 'Grifters gonna grift!' || Number(asset.token_id) < 275;

  let s = '';

  s = s + '<script>function goto(url) { window.open(url, "_blank"); }</script>';

  // s = s + `<div onclick="location.href='grifters-by-xcopy.html';" style="cursor: pointer;">`;
  s = s + `<div style="cursor: pointer;">`;
  // s = s + `<a href="xxx"><div title="Grifters gonna grift!">`;
  let ct = 0;
  const assets = config.runtime.assets.sort((a, b) => compareOrderedNum(Number(b.token_id), Number(a.token_id)));
  console.log(assets.map(obj => obj.token_id));
  for (let asset of assets) {
    if (isGrifter(asset)) {
      console.log(asset.token_id);
      const insult = getgetInsult();
      // const title = asset.listing_price ? `${insult}, buy me NOW for ${asset.listing_price} ETH!` : `${randomNotForSalePhrase()}`;
      const title = `${insult}! ${randomNotForSalePhrase()}`;
      // s = s + `<img class="grifter_thumb" src="${asset.image_thumbnail_url}" loading="lazy" />`;
      s = s + `<img class="thumb" src="${asset.image_thumbnail_url}" loading="lazy" title="${title}" onclick="goto('${asset.permalink}')" />`;
      ct++;
    }
  }
  s = s + '</div>';
  /*
  s = s + `<div class="about">
    <a href="mailto:0xhstream@gmail.com">0xhstream@gmail.com</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
    <a href="https://twitter.com/0xHstream" target="_blank">https://twitter.com/0xHstream</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
    <a href="https://0xhstream.github.io/grifters.html">Grifters by XCOPY Rarity Ranking and Other Stats</a>`;
       */
  s = s + `<div class="about">
            <a href="./blueprints.html">Rarity and Other Stats</a><!--&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
            <a href="./grifters-gonna-claim.html">Claim this site</a>-->
           </div>`;
  console.log('ct', ct);

  const html = compiledFunction({
    title: 'Grifters by XCOPY',
    description: 'Grifters, XCOPY, Async Art, Blueprint, NFT, Cryptoart',
    content: s,
  });

  ensureFolder(path.resolve(global.__datadir, 'grifters'));
  const filepath = path.resolve(global.__datadir, 'grifters', 'grifters-gonna-grift.html');
  writeFile(filepath, html);
  open(filepath, { app: 'chrome' });
}

export async function writeGriftersGonnaClaim(config) {
  let s = '';
  s = s + `
    <div class="box">
      <div class="row header">
      </div>
      <div class="row content claim">
        <p>
          If you are XCOPY and don't approve of this site, contact <a href="mailto:0xhstream@gmail.com">me</a><br>and I'll take it down and transfer the grifters.io domain to you.
        </p>
        <p>Any fun ideas for content on this domain?</p>
      </div>
      <div class="row footer">
      </div>
    </div>
  `;

  const compiledFunction = compileFile('src/templates/grifters-gonna-claim.pug');
  const html = compiledFunction({
    title: 'Grifters gonna claim!',
    description: 'Grifters, XCOPY, Async Art, Blueprint, NFT, Cryptoart',
    content: s,
  });

  ensureFolder(path.resolve(global.__datadir, 'grifters'));
  const filepath = path.resolve(global.__datadir, 'grifters', 'grifters-gonna-claim.html');
  writeFile(filepath, html);
  open(filepath, { app: 'chrome' });
}

export async function test() {
  const compiledFunction = compileFile('src/templates/test.pug');

  const html = compiledFunction({
    title: 'custom title',
    description: 'custom description',
    header: 'header',
    mainContent: 'mainContent',
    footnotes: 'footnotes',
  });

  const filepath = path.resolve(global.__datadir, 'test.html');
  writeFile(filepath, html);
  open(filepath, { app: 'chrome' });
}

export async function chartTest(data) {
  /*
  var data = [
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
  */

  const compiledFunction = compileFile('src/templates/chart.pug');

  const html = compiledFunction({
    title: 'custom title',
    description: 'custom description',
    header: 'header',
    chart: createChart('chart', data, 1500, 800, 'All Time Floor Price for Grifters by XCOPY', 'steelblue'),
    mainContent: 'htmlTable',
    footnotes: 'footnotes',
  });

  const filepath = path.resolve(global.__datadir, 'chart.html');
  writeFile(filepath, html);
  open(filepath, { app: 'chrome' });
}

export function createIndexFile(config) {
  const index = Object.keys(config.runtime.collections).map(key => {
    const obj = config.runtime.collections[key];
    if (!obj.tokens || !obj.tokens[0]) {
      return '';
    }
    return `<p><a href="${normalizeFilename(obj.tokens[0]?.edition_name)}.html">${createTitle(obj)}</a></p>`;
  }).join('\n');

  const content = `
  <h1>Grifters gonna grift!</h1>

  <p>
  Keeping this page updated is way too much work!
    <br>
    Grifters by XCOPY rarity page will be published
    <br>
    here without updated price data:
  <br><br>
  <b><a href="grifters.html">Grifters by XCOPY rarity rankings</a></b>
  <br><br>

    For rarity rankings and price data of <a href="https://async.art/blueprints" target="_blank">all Blueprint collections</a>,
    <br>
    I can create an updated set of pages for a fee.
    <br><br>
    Email: <a href="mailto:0xhstream@gmail.com">0xhstream@gmail.com</a>
    <br><br>
Examples of rare items (Jan 22, 2022) to buy:
<br><br>

<img src="./example-buy.png" />
  `;

  const compiledFunction = compileFile('src/templates/index.pug');

  const html = compiledFunction({
    title: 'Grifters by XCOPY and other Blueprint collections',
    description: 'Grifters, XCOPY, Async Art, Blueprint, NFT, Cryptoart',
    content: content,
  });

  const filepath = path.resolve(global.__datadir, 'blueprints', 'index.html');
  writeFile(filepath, html);

  open(filepath, { app: 'chrome' });
}

export async function createCollectionFiles(config, collection) {
  log.info('Write files for collection:', collection.name);

  const baseFilename = normalizeFilename(collection.name);

  const filenames = {
    index: `${baseFilename}.html`,
    price: `${baseFilename}-price.html`,
    daysListed: `${baseFilename}-days-listed.html`,
    lastPrice: `${baseFilename}-last-price.html`,
    lastDays: `${baseFilename}-last-days.html`,
    numSales: `${baseFilename}-num-sales.html`,
    owner: `${baseFilename}-owner.html`,
    token: `${baseFilename}-token.html`,
  };

  const dataSource = createDataSource(config, collection);

  for (let key of Object.keys(filenames)) {
    const filename = filenames[key];
    log.info('Write file:', filename);
    const html = await createCollectionPageHtml(config, collection, dataSource, filename, filenames);
    const filepath = path.resolve(global.__datadir, 'blueprints', filename);
    writeFile(filepath, html);
  }

  open(path.resolve(global.__datadir, 'blueprints', `${baseFilename}.html)`), { app: 'chrome' });
}

export async function createCollectionPageHtml(config, collection, dataSource, filename, filenames) {
  const selectedData = getSelectedData(dataSource, filename);

  const makeHeader = (filename, header, title) => `<a href="./${filename}" title="${title}" class="sort-icon">${header} <i class="fa fa-sort"></i></a>&nbsp;`;

  const headers = {
    'imageHtml': '',
    'nameHtml': 'Name',
    'rankHtml': makeHeader(filenames.index, 'Rarity', 'Sort by rarity rank'),
    'topHtml': 'Top',
    'priceHtml': makeHeader(filenames.price, 'Price', 'Sort by lowest price'),
    'listingDaysHtml': makeHeader(filenames.daysListed, 'Days Listed', 'Sort by most days listed'),
    'lastSalePriceHtml': makeHeader(filenames.lastPrice, 'Last Sale Price', 'Sort by highest last sale price'),
    'lastSaleDaysHtml': makeHeader(filenames.lastDays, 'Last Sale Day', 'Sort by most recent last sale day'),
    'numSalesHtml': makeHeader(filenames.numSales, 'Sales', 'Sort by most sales'),
    'ownerHtml': makeHeader(filenames.owner, 'Owner', 'Sort by most Grifters owned'),
    'openseaHtml': 'Sales Page',
    'homePageHtml': 'Token Page',
    'scoreHtml': 'Score',
    'tokenIdHtml': makeHeader(filenames.token, 'Token ID', 'Sort by token ID'),
  };

  const header = createHeader(config, collection, dataSource, selectedData);
  const footnotes = createFootnotes(config, filename);

  const selectedSortColumnStyleKeys = [
    { f: filenames.index, v: 'rankhtml-th' },
    { f: filenames.price, v: 'pricehtml-th' },
    { f: filenames.daysListed, v: 'listingdayshtml-th' },
    { f: filenames.lastPrice, v: 'lastsalepricehtml-th' },
    { f: filenames.lastDays, v: 'lastsaledayshtml-th' },
    { f: filenames.numSales, v: 'numsaleshtml-th' },
    { f: filenames.owner, v: 'ownerhtml-th' },
    { f: filenames.token, v: 'tokenidhtml-th' }
  ];
  const selectedSortColumnStyle = selectedSortColumnStyleKeys.find(obj => obj.f === filename)?.v;
  const selectedSortColumnStyleHtml = `<style>.${selectedSortColumnStyle} { background: #fa3e96 }</style>`;

  const editionName = collection.tokens[0].edition_name;
  const imageDimensions = config.collectionPrefs[editionName]?.imageDimensions ?? config.imageDimensions;
  const imageSizeStyleHtml = `<style>.thumbnail { ${imageDimensions} }</style>`;

  const htmlTable = new TableBuilder({ 'class': 'main-table' })
      .setHeaders(headers)
      .setData(dataSource)
      .render()
    + selectedSortColumnStyleHtml
    + imageSizeStyleHtml
    || 'Data collection is empty!';

  const compiledFunction = compileFile('src/templates/collection.pug');

  return compiledFunction({
    title: createTitle(collection),
    description: createDescription(collection),
    header,
    mainContent: htmlTable,
    footnotes,
  });
}

function createChart(runtime, editionName, artist) {
  const data = runtime.floorHistory.filter(obj => obj.edition_name === editionName)
    .filter(obj => obj.short_date && obj.floor_price)
    .map(obj => {
      return { x: obj.short_date, y: obj.floor_price };
    });

  return createChartScriptHtml('chart', data, 600, 400, `All Time Floor Price for ${normalizeFilename(editionName)} by ${artist}`);
}

function createChartScriptHtml(chartElemId, data, width, height, yLabel, color = 'steelblue') {
  return `
    <div class="chart-container" id='chart'></div>
    ${lineChartScriptHtml(chartElemId, data, width, height, yLabel, color)}
  `;
}

function getSelectedData(dataSource, filename) {
  if (filename.endsWith('-price.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.price, b.price, true));
  }
  if (filename.endsWith('-days-listed.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.listing_days, b.asset?.listing_days, false));
  }
  if (filename.endsWith('-last-price.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.last_sale_price, b.asset?.last_sale_price, false));
  }
  if (filename.endsWith('-last-days.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.last_sale_days, b.asset?.last_sale_days, true));
  }
  if (filename.endsWith('-num-sales.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(a.asset?.num_sales, b.asset?.num_sales, false));
  }
  if (filename.endsWith('-owner.html')) {
    return dataSource.sort((a, b) => compareOwner(a.num_owned, b.num_owned, false, String(a.owner), String(b.owner), true));
  }
  if (filename.endsWith('-token.html')) {
    return dataSource.sort((a, b) => compareOrderedNum(Number(a.token_id), Number(b.token_id), true));
  }

  return dataSource.sort((a, b) => compareOrderedNum(a.score_rank, b.score_rank, true));
}

function createDataSource(config, collection) {
  return collection.tokens.map(tokenData => {
      const token = { ...tokenData };

      const asset = config.runtime.assets?.find(obj => obj.token_id === token.token_id);

      token.asset = asset;

      const editionName = collection.tokens[0].edition_name;
      const imageVarName = config.collectionPrefs[editionName]?.image ?? config.imageD;

      const imageUrl = token[imageVarName] ?? token.image_preview_url ?? token.image_thumbnail_url ?? token.image_url ?? IMAGE_NOT_FOUND_URL;
      const imageHtml = `<a target='_blank' href='${token.permalink}'><img src='${imageUrl}' class='thumbnail' title='${createThumbImageTitle(token, collection.tokens.length)}'></a>`;

      const nameParts = token.name.split('#');
      const nameHash = nameParts.length === 2 ? `#${nameParts[1]}` : '';
      const nameHtml = `<a id="${nameHash}">${token.name}</a>`;

      const rankHtml = token.score_rank;
      const topHtml = `${normalizePct(token.score_top * 100, '%')}`;

      const priceHtml = `${normalizePrice(token.price ?? null, 2, '', ' ETH')}`;
      const listingDaysHtml = normalizeNumber(asset?.listing_days ?? null, '', ` ${normalizePlural(asset?.listing_days, 'day', 'days')}`);

      const lastSalePriceHtml = `${normalizePrice(asset?.last_sale_price ?? null, 2, '', ' ETH')}`;
      const lastSaleDaysHtml = normalizeNumber(asset?.last_sale_days ?? null, '', ` ${normalizePlural(asset?.last_sale_days, 'day', 'days')} ago`);

      const numSalesHtml = normalizeNumber(asset?.num_sales ? asset?.num_sales : null, '', ` ${normalizePlural(asset?.num_sales ?? 0, 'sale', 'sales')}`);

      const ownerUrl = token.owner_opensea_url ?? token.owner_async_url;
      const ownerHtml = `<a target="_blank" href="${ownerUrl}">${normalizeUsernameText(token.owner_opensea ?? token.owner_async)}</a> (${token.num_owned} pcs)`;

      const openseaHtml = `<a target="_blank" href="${token.permalink}">OpenSea</a>`;
      const homePageHtml = `<a target="_blank" href="${token.home_url}">Async Art</a>`;

      const scoreHtml = `${token.score.toFixed(2)} pts`;

      const tokenIdHtml = `<a id="${token.token_id}">#${token.token_id}</a>`;

      const tokenHtml = {
        imageHtml,
        nameHtml,
        rankHtml,
        topHtml,
        priceHtml,
        listingDaysHtml,
        lastSalePriceHtml,
        lastSaleDaysHtml,
        numSalesHtml,
        ownerHtml,
        openseaHtml,
        homePageHtml,
        scoreHtml,
        tokenIdHtml,
      };

      return { ...token, ...tokenHtml };
    }
  )
    ;
}

function compareOwner(a1, b1, ascending1, a2, b2, ascending2) {
  if (!a1 && !b1) {
    return 0;
  }
  if (a1 !== b1) {
    return ascending1 ? a1 - b1 : b1 - a1;
  }
  return compareOrderedString(a2, b2, ascending2);
}

function createTitle(collection) {
  return `${collection.tokens[0]?.edition_name} by ${collection.tokens[0]?.edition_artist}`;
}

function createHeaderTitle(collection) {
  return `${createTitle(collection)}: Rarity Rankings and Other Stats`;
}

function createDescription(collection) {
  return `${collection.tokens[0]?.edition_name} by ${collection.tokens[0]?.edition_artist}: Rarity Rankings and Other Stats, ${collection.tokens[0]?.edition_artist}, Async Art, Blueprints, NFT, Cryptoart`;
}

function createHeader(config, collection, dataSource, selectedData) {
  const modifiedText = collection.modified ? collection.modified.toLocaleString() : 'Unknown';
  const artist = collection.tokens[0].edition_artist;
  const capacity = collection.tokens[0].capacity;
  const editionName = collection.tokens[0].edition_name;

  const artistUrl = config.collectionPrefs[editionName]?.artistUrl ?? null;
  const artistWebPageHtml = artistUrl ? `<a href="${artistUrl}" target="_blank">Artist Web Page</a>&nbsp;&nbsp;|&nbsp;&nbsp;` : '';

  const chartHtml = ''; // createChart(config.runtime, editionName, artist);

  return `
    <div class="page-header">

<!--
    <div class="service-note">
      This is a free to use service. To support further development, feel free to make a contribution:
      <a href="https://etherscan.io/address/0x8C72070AA747F3F314a34Bd8bc741FCa6713F81C"
         target="_blank">0x8C72070AA747F3F314a34Bd8bc741FCa6713F81C</a>
    </div>
    -->

  <div class="header-text">
    <h1>${createHeaderTitle(collection)}</h1>
    </div>
         <form action="#" method="get" id="search-form" name="query"
        onSubmit="var e=document.getElementById(this.gid.value); if (!e) { document.getElementById('search-result').style.visibility='visible'; return false}; document.getElementById('search-result').style.visibility='hidden'; var rect=e.getBoundingClientRect(); window.scroll(0, rect.top); return false;">

         <div class="edition-image"><img src="${collection.tokens[0].edition_image_url}"></div>

         <div class="header-links">
          <a href="${collection.tokens[0].edition_url}" target="_blank">Collection Home Page</a>&nbsp;&nbsp;|&nbsp;&nbsp;
            ${artistWebPageHtml}
            <a href="./blueprints/index.html">Rarity and Stats for more Blueprint Collections</a>
         </div>

         <div class="floor">${createFloor(collection.floors)}</div>

<!--

         ${chartHtml}
         -->

         <div class="search">
         <b>Updated: ${modifiedText}</b>&nbsp;&nbsp;|&nbsp;&nbsp;
         1-${selectedData.length} of ${collection.tokens.length} minted tokens (max capacity: ${capacity})&nbsp;&nbsp;|&nbsp;&nbsp;
         Go to Name # or Token ID:
            <input type="text" size="16" name="gid" onfocus='this.value=""' placeholder="#123">
            <span id="search-result" style="visibility: hidden">Not found</span>
        </div>
        </form>
      </div>`;
}

function createFootnotes(config, filename) {
  return `
  <p id="footnotes">
    <p><b>DISCLAIMERS AND NOTES:</b></p>
    <p>This web page is not associated with Async Art or any artist. Rarity.tools ranking method used with
      Trait Normalization ${config.rules.normalize ? 'On' : 'Off'},
      Trait Count ${config.rules.traitCount ? 'On' : 'Off'}, Additional Weight ${config.rules.additionalWeight ? 'On' : 'Off'}.
      This may or may not represent an actual rarity for this collection. And traits rarity may not
      matter much anyway, who knows, aesthetics may be more important and people simply buy what they
      like. Anyway, use with own discretion, not financial advice, DYOR, etc.</p>

<!--
    <p>
      This is a free to use service. To support further development, feel free to make a contribution:
      <a href="https://etherscan.io/address/0x8C72070AA747F3F314a34Bd8bc741FCa6713F81C"
         target="_blank">0x8C72070AA747F3F314a34Bd8bc741FCa6713F81C</a>
    </p>
    -->

  </div>
  <hr>
  By: <img class="floor-image"
              src="https://lh3.googleusercontent.com/eMVIBIVS1YPB2I6DA9Tc2iQI1JB3Z5lzH29friUD24m0GWc4WytlT91YcMuYx-WQqjOYOyTN-naKjnraAJnP9d91Lb8LZ9wINg5Z=w600">
    <a href="https://async.art/blueprints/61b6c374bd2df4be86ef7aa5/editions/0xc143bbfcdbdbed6d454803804752a064a622c1f3-127" target="_blank">Grifter #126</a> &nbsp; | &nbsp;
    <a href="https://twitter.com/0xHstream" target="_blank">https://twitter.com/0xHstream</a> &nbsp; | &nbsp;
    <a href="mailto:0xHstream@gmail.com" target="_blank">0xHstream@gmail.com</a> &nbsp; | &nbsp;
    <img src="https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2F0xhstream.github.io%2F${filename}&count_bg=%2379C83D&title_bg=%23555555&icon=&icon_color=%23E7E7E7&title=Hits&edge_flat=false"/>
  `;
}

function createFloor(floors) {
  let html = '';
  const add = (s) => html = html + s;

  if (floors.length < 1) {
    add('Floor: No data found');
    return html;
  }

  add('<ul class="cloud" role="navigation">');
  for (let floor of floors) {
    const price = floor.data.price > 0 ? normalizePrice(floor.data.price) : (floor.data.token_id !== undefined ? 'Not for sale' : 'Not found');
    const weight = floor.data.price ? Math.round(floor.data.price) : 0;
    const normalizedWeight = weight > 100 ? 100 : (weight < 0 ? 0 : weight);
    const permalink = floor.data.permalink;
    const imageUrl = floor.data.image_thumbnail_url ?? IMAGE_NOT_FOUND_URL;
    add(`<li><a target="_blank" href="${permalink}"><img class="floor-image" src="${imageUrl}"> ${floor.name} (${floor.qty ?? '?'} pcs) Floor: ${price} ETH</a></li>`);
  }
  add('</ul>');

  return html;
}

function createThumbImageTitle(token, numTokens) {
  const traits = [...token.traits].sort((a, b) => b.score - a.score);
  const traitsText = traits.map(trait => `${normalizePct(trait.freq * 100)}%   ${trait.trait_type}: ${trait.value}   (${trait.num_with_this_trait} of ${numTokens})   (${trait.score.toFixed(2)} pts)`).join('\n');
  let s = '';
  s = s + `Token ID: ${token.token_id}`;
  s = s + `\n`;
  s = s + `Name: ${token.name}`;
  s = s + `\n\n`;
  /*
  s = s + `Description: ${normalizeDescription(token.description)}`;
  s = s + `\n\n`;
  */
  s = s + `Rarity rank: ${token.score_rank}`;
  s = s + `\n`;
  s = s + `Top: ${normalizePct(token.score_top * 100, '')}%`;
  s = s + `\n`;
  s = s + `Score: ${token.score.toFixed(2)} pts`;
  s = s + `\n\n`;
  s = s + `TRAITS:`;
  s = s + `\n`;
  s = s + `${traitsText}`;
  s = s + `\n\n`;
  s = s + `\n\n`;

  return s;
}

function normalizeFilename(name) {
  return name.trim().replace(/[^a-z0-9]/gi, '-').trim().toLowerCase();
}

function normalizePlural(num, singular, plural) {
  return num === 1 ? singular : plural;
}

function normalizeDescription(val) {
  return val.replaceAll('\'', '´');
}

function normalizePrice(val, defaultDecimals = 3, undefinedResult = '', suffix = '') {
  if (typeof val !== 'number') {
    return undefinedResult;
  }

  if (val >= 1000000000) {
    return `${(val / 1000000000).toFixed(0)}G${suffix}`;
  }

  if (val >= 1000000) {
    return `${(val / 1000000).toFixed(0)}M${suffix}`;
  }

  if (val >= 1000) {
    return `${(val / 1000).toFixed(0)}K${suffix}`;
  }

  const textPrice = val.toString(10);
  const textPriceSplit = textPrice.split('.');
  const numDecimals = textPriceSplit.length < 2 ? 0 : textPriceSplit[1].length;

  return `${val.toFixed(numDecimals > 2 ? 2 : numDecimals)}${suffix}`;

  if (val < 1) {
    return `${val.toFixed(defaultDecimals)}${suffix}`;
  }

  if (val < 10) {
    return `${val.toFixed(2)}${suffix}`;
  }

  return `${val.toFixed(2)}${suffix}`;
}

function normalizeNumber(val, undefinedResult = '', suffix = '') {
  return typeof val === 'number' ? `${val.toFixed(0)}${suffix}` : undefinedResult;
}

function normalizeLongDate(val, undefinedResult = '', suffix = '') {
  return (val instanceof Date) ? `${val.toLocaleString()}${suffix}` : undefinedResult;
}

function normalizeShortDate(val, undefinedResult = '', suffix = '') {
  return (val instanceof Date) ? `${val.toLocaleDateString()}${suffix}` : undefinedResult;
}

function normalizePct(val, suffix = '') {
  if (val < 0.1) {
    return `${val.toFixed(2)}${suffix}`;
  } else if (val < 10) {
    return `${val.toFixed(1)}${suffix}`;
  } else {
    return `${val.toFixed(1)}${suffix}`;
  }
}

function normalizeUsernameText(username, maxLength = 15, undefinedResult = '') {
  if (typeof username !== 'string') {
    return undefinedResult;
  }
  if (username.length > maxLength) {
    return `${username.substr(0, maxLength)}...`;
  }
  return username;
}

function normalizeAddressText(address, length = 8, undefinedResult = '') {
  if (typeof address !== 'string') {
    return undefinedResult;
  }
  return `${address.substr(0, length)}...`;
}
