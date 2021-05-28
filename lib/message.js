const request = require('request-promise-native');
const config = require('../config');
const {renderTradePhoto, renderOrderPhoto} = require('./chart');
let prev_msg_id = 0;
let prev_to_id = "";
let prev_mo_id = "";
let prev_quantity = 0;
// let test = false;

let CHAT_ID = config.CHAT_ID;
const baseUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}`;

const trade_datas = {
  exchanges: {
    binance: 'BN',
    bitfinex: 'BF',
    coinbase: 'CB'
  },
  price: [],
  sell: [],
  buy: []
};

const sendMessage = (chatOptions) => {
  return request(chatOptions)
  .catch(function (err) {
    console.log("Main:", err.message);
  });
}

const sendPhoto = (chatId, photo, caption='') => {
  const uriPath = [
    'parse_mode=Markdown',
    `chat_id=${chatId}`,
    `caption=${encodeURIComponent(caption)}}`,
    `photo=${encodeURIComponent(photo)}}`
  ].join('&')
  const chatOptions = {
    uri: `${baseUrl}/sendPhoto?${uriPath}`,
    headers: {
        'User-Agent': 'Request-Promise'
    },
    json: true
  };
  return request(chatOptions)
  .catch(function (err) {
    console.log("Main:", err.message);
  });
}

const build = (messageObj) => {
  let event = messageObj.event;
  let symbol = messageObj.symbol;
  let quantity = messageObj.quantity;
  let price = messageObj.price;
  let exchange = messageObj.exchange;
  let to_id = undefined;
  let mo_id = undefined;
  let isAggregate = messageObj.isAggregate;
  let encoded_message = "";
  let aggr_msg = "";
  let order_ids = "";
  let special_msg = "";
  let base = "";
  let currency = "";
  if(symbol) {
    let unformatted = symbol.replace("-","");
    base = unformatted.substr((symbol.substr(-4) == "USDT"?-4:-3));
    // base = (/^USD(T)?$/.test(base)?"$":base);
    currency = unformatted.replace(base, "");
  }
  
  if(exchange == 'coinbase') {
    to_id = messageObj.taker_order_id;
    mo_id = messageObj.maker_order_id;
    let taker = "";
    let maker = "";
    if(quantity < 0) {
      taker = "seller";
      maker = "buyer";
    } else {
      taker = "buyer";
      maker = "seller";
    }
    order_ids = `\n${taker}-orderId: ${to_id.substring(to_id.length - 4)}\n${maker}-orderId: ${mo_id.substring(mo_id.length - 4)}`;
    aggr_msg = isAggregate?"\n**Aggregated**":"";
    special_msg = order_ids + aggr_msg;
  }
  
  if(event == "VOLUME") {
    let type = messageObj.type;    
    let side = messageObj.side;
    let size = Math.round(messageObj.size);
    if(typeof type == "object") {
      special_msg = `( order of ${type[1]} ${currency} placed at ${type[0]} ${base})\n`;
    } 
    encoded_message = encodeURIComponent(`*VOLUME:*\n${symbol} (${exchange})\n${special_msg}Total ${side} volume = ${quantity} ${currency}, which is around ${size} times bigger than counterpart`);

  }
  else if(event == "TRADE") {
    if(quantity < 0)
      encoded_message = encodeURIComponent(`*TRADE:*\n${symbol} (${exchange})\nSold ${quantity*-1} at ${price} ${base}${special_msg}`);
    else
      encoded_message = encodeURIComponent(`*TRADE:*\n${symbol} (${exchange})\nBought ${quantity} at ${price} ${base}${special_msg}`);
  }
  else if(event == "limit-change") {
    encoded_message = encodeURIComponent('*Limit change requested.*');
  } 
  else if(event == "WD") {
    let side = messageObj.side;
    encoded_message = encodeURIComponent(`*VOLUME:*\n${symbol} (${exchange})\n${side} volume is down compared to before`);
  }
  
  if(config.TESTING)
    CHAT_ID = config.TEST_CHAT_ID;

  if (event == "TRADE") {
    const today = +new Date();
    const qvalue = quantity < 0 ? -1*quantity : quantity;
    const trade = quantity < 0 ? 'sell' : 'buy';
    trade_datas.price.push([today, price])
    trade_datas[trade].push({
      x: today,
      y: price,
      z: qvalue,
      name: trade_datas.exchanges[exchange]
    });

    renderTradePhoto(trade_datas.price, trade_datas.sell, trade_datas.buy)
    .then(res => {

    })
  } else if (messageObj.hasOwnProperty('book')) {
    const book = messageObj.book;
    const findWhale = (bids) => {
      let total = 0;
      return bids
          .map(bid => {
            total += bid[1];
            return [bid[0], bid[1], total]
          })
          .filter(bid => bid[1] >= book.min_worth)
          .map(bid => {
            return {
              x: bid[0],
              y: bid[2],
              z: 10*bid[1],
              name: trade_datas.exchanges[exchange]
            };
          });
    };
    // whaleBids
    const whaleBids = findWhale(book.bids);
    const whaleAsks = findWhale(book.asks);
    
    const asks = book.asks.slice();
    let total = 0;
    asks.slice().reverse().forEach((ask, idx) => {
      total += ask[1];
      asks[idx][1] = total
    })

    total = 0;
    const bids = book.bids.slice();
    bids.forEach((bid, idx) => {
      total += bid[1];
      bids[idx][1] = total
    })

    renderOrderPhoto(bids, asks, whaleBids, whaleAsks)
    .then(res => {

    })
  }

  // DUMMY: don't send message
  console.log(`DUMMY, no send ${event} message`);
  return;

  var chatOptions = {
    uri: `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage?parse_mode=Markdown&chat_id=${CHAT_ID}&text=${encoded_message}`,
    headers: {
      'User-Agent': 'Request-Promise'
    },
    json: true
  };
  
  if(to_id == prev_to_id || mo_id == prev_mo_id) {
    if(quantity > prev_quantity) {
      chatOptions.uri = `https://api.telegram.org/bot${config.BOT_TOKEN}/editMessageText?parse_mode=Markdown&chat_id=${CHAT_ID}&message_id=${prev_msg_id}&text=${encoded_message}`;
      sendMessage(chatOptions)
      .then((res) => {
        // console.log("This is res:", res);
        if(res && res.ok) {
          prev_msg_id = res.result.message_id;
          prev_quantity = quantity;
        } else {
          console.log("Message update failed");
        }
        // console.log(res.result.text+" updated");
      });
    }
  } else {
    // console.log(encoded_message);
    sendMessage(chatOptions)
    .then((res) => {
      if(res && res.ok) {
        prev_msg_id = res.result.message_id;
        prev_quantity = quantity;
      } else {
        console.log("Message sending failed");
      }
      // console.log(res.result.text+" sent");
    });
  }
  
  if(to_id != undefined && mo_id != undefined) {
    prev_to_id = to_id;
    prev_mo_id = mo_id;
  }
}

module.exports = build;