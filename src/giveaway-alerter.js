var discordWebHookURL = 'https://discord.com/api/webhooks/921817016787169290/P3Ipp9hAdT63La-47e-wXxeavcr5Qh5y0SbSp_1nIzBwNXLEGa13sN-JWeHsPTM8Aey8';
var notifyBrowserURL = 'https://0xhstream.github.io/giveaway-alert-notification.mp3';
var userid = '1234';
var email = 'andreas71@gmail.com';
var phone = '';
var query = '';
var queryIsStrict = false;
var notifierName = '';
var debug = false;
var checkEverySecs = 30;

var sendInterval = 30;
var delayOwnMsg = 3;

var nextSend = new Date();
var lastServer = null;
var lastChannel = null;
var lastChannelFromTimestamp = null;
var lastTimestamp = null;
var lastQueryHit = null;
var lastQueryHitMsg = null;

MutationObserver = window.MutationObserver || window.WebKitMutationObserver;

function log(...args) {
  if (debug) {
    console.log(...args);
  }
}

function processMessages() {
  var messageList = document.querySelectorAll('[data-list-id="chat-messages"]');
  if (!messageList || !messageList[0]) {
    log('No message list, skip');
    return null;
  }

  var label = messageList[0].getAttribute('aria-label');
  lastChannelFromTimestamp = label.replace('Messages in ', '');
  log('lastChannelFromTimestamp:', lastChannelFromTimestamp);

  log('lastTimestamp:', lastTimestamp);

  if (!messageList[0].children) {
    log('No message list children, skip');
    return null;
  }

  lastQueryHit = null;
  lastQueryHitMsg = null;
  let latestTimestamp = null;
  Array.from(messageList[0].children).forEach(obj => {
    if (obj.nodeName === 'LI') {
      /* log('-----------------------', obj); */
      var timestamp = obj.id.replace('chat-messages-', '');
      var key = 'message-content-' + timestamp;
      log('timestamp, lastTimestamp', timestamp, lastTimestamp);
      log('----------------------- message:', document.getElementById(key)?.innerText);
      if (timestamp <= lastTimestamp) {
        log('Message timestamp < lastTimestamp, already processed, skip!');
        return;
      }
      latestTimestamp = timestamp > latestTimestamp ? timestamp : latestTimestamp;
      log('latestTimestamp', latestTimestamp);

      if (!lastTimestamp) {
        log('No lastTimestamp, channel has not been updated with new content, skip');
        /* If no lastTimestamp, channel has not been updated with new content, do not alert! */
        return;
      }

      var message = document.getElementById(key)?.innerText;
      log('----------------------- message:', message);

      var messageStrict = message.trim();

      if (query && queryIsStrict && message.trim() === query) {
        lastQueryHit = query;
        lastQueryHitMsg = message;
        log('-----------------------lastQueryHit', lastQueryHit);
        return;
      }

      if (query && !queryIsStrict && message.toLowerCase().includes(query.toLowerCase())) {
        lastQueryHit = query;
        lastQueryHitMsg = message;
        log('-----------------------lastQueryHit', lastQueryHit);
        return;
      }
    }
  });

  return latestTimestamp;
}

function processor() {
  console.log('Giveaway Alerter check for changes...');
  checkForChanges(null, null);
  setTimeout(() => processor(), checkEverySecs * 1000);
}

function getServer() {
  var server = document.querySelector('h1').innerText;
  log('--- server', server);
  return server;
}

function getChannel() {
  log('channelFromTimestamp', lastChannelFromTimestamp);
  log('document.title', document.title);
  return lastChannelFromTimestamp || document.title;
}

function hasInvalidQuery() {
  if (query && !lastQueryHit) {
    return true;
  }
  return false;
}

function hasValidMutation(mutations) {
  if (!mutations) {
    return false;
  }
  let hasValid = false;
  mutations.forEach(m => {
    log('className', m.target.className);
    if (!m.target || !m.target.className || typeof m.target.className !== 'string') {
      log('invalid mutation');
      return;
    }
    if (m.target.className.includes('textArea-')) {
      /* User send own message, skip and delay to ignore own messages! */
      log('------------ textArea');
      delayNextSend(delayOwnMsg);
      return;
    }
    if (m.target.className.includes('message-') || m.target.className.includes('scroller-')) {
      log('hasValid TRUE');
      hasValid = true;
    }
  });
  log('hasValid:', hasValid);
  return hasValid;
}

function init(flShowInfo = true) {
  lastServer = getServer();
  lastChannel = getChannel();
  lastTimestamp = processMessages();

  if (flShowInfo) {
    showInfo();
  }

  setTimeout(() => processor(), 0);
}

function checkForChanges(mutations, observer) {
  log('OBSERVE');

  var latestTimestamp = processMessages();
  log('latestTimestamp', latestTimestamp);

  var currentServer = getServer();
  var currentChannel = getChannel();
  var hasSwitched = currentServer !== lastServer || currentChannel !== lastChannel;
  lastServer = currentServer;
  lastChannel = currentChannel;

  if (hasSwitched) {
    log('Switched server or channel');
    lastTimestamp = latestTimestamp || lastTimestamp;
    log('lastTimestamp2', lastTimestamp);
    delayNextSend(-1);
    return;
  }

  if (tooEarly()) {
    lastTimestamp = latestTimestamp || lastTimestamp;
    log('Too early, skip');
    return;
  }

  if (mutations && !hasValidMutation(mutations)) {
    log('No valid mutations, skip');
    return;
  }

  if (hasInvalidQuery()) {
    log('No valid query, skip');
    return;
  }

  var newTimestamp = latestTimestamp || lastTimestamp;
  /*  log('lastTimestamp, newTimestamp:', lastTimestamp, newTimestamp); */
  if (newTimestamp && newTimestamp > lastTimestamp) {
    log('Updated timestamp, notify!');
    notifyDiscord();
    lastTimestamp = newTimestamp;
  } else {
    log('No new timestamp, skip');
  }
};

function delayNextSend(secs = sendInterval) {
  var t = new Date();
  log('t', t);
  t.setSeconds(t.getSeconds() + secs);
  log('old delayNextSend', nextSend);
  nextSend = t;
  log('new delayNextSend', nextSend, secs);
}

function tooEarly() {
  var now = new Date();
  log('tooEarly, now, nextSend', now < nextSend, now, nextSend,);
  return now < nextSend;
}

function creatNotifyDiscordMsg() {
  return 'notifierName=' + notifierName + '&userid=' + userid + '&channel=' + getChannel() + '&server=' + getServer() + '&email=' + email + '&phone=' + phone + '&query=' + query + '&queryHit=' + lastQueryHit + '&queryHitMsg=' + lastQueryHitMsg;
}

function creatNotifyBrowserMsg() {
  return '?channel=' + getChannel() + '&server=' + getServer() + (lastQueryHit ? '&query=' + lastQueryHit : '') + (notifierName ? '&notifierName=' + notifierName : '');
}

function showInfo() {
  var s = '';
  s = s + 'GIVEAWAY NOTIFIER SETTINGS\n(To change these, go to github.io/giveawaynotifier)\n\n';
  s = s + 'Notifier Name: ' + (notifierName ? notifierName : '(none)') + '\n';
  s = s + 'Query: ' + (query ? query : '(none, all updates will be notified)') + '\n';
  var queryType = 'Query Type: ' + (queryIsStrict ? 'Exact match' : 'Loose match') + '\n';
  s = s + (query ? queryType : '');
  s = s + 'Notify to email: ' + (email ? email : '(none)') + '\n';
  s = s + 'Notify to phone: ' + (phone ? phone : '(none)') + '\n';
  s = s + 'Notify in browser, URL: ' + (notifyBrowserURL ? notifyBrowserURL : '(none)') + '\n';
  s = s + 'Userid: ' + userid + '\n';
  window.alert(s);
}

function notifyBrowser() {
  if (notifyBrowserURL) {
    /* todo: open in new or old window? */
    window.open(notifyBrowserURL + creatNotifyBrowserMsg());
  }
}

function notifyDiscord() {
  log('----------------------------------------------- NOTIFY');
  notifyBrowser();
  fetch(discordWebHookURL, {
    method: 'post',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: creatNotifyDiscordMsg() })
  }).then(res => log('HTTP status:', res.status))
    .catch(error => console.error(error));
  delayNextSend();
}

var observer = new MutationObserver(checkForChanges);

observer.observe(document, {
  subtree: true,
  attributes: true
});

init();
