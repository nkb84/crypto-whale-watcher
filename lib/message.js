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
    const zvalue = qvalue*price*messageObj.usd_price
    trade_datas.price.push([today, price])
    trade_datas[trade].push({
      x: today,
      y: price,
      z: zvalue/1000,
      name: trade_datas.exchanges[exchange.toLowerCase()]
    });

    const title = `${exchange}) ${quantity < 0 ? 'Sold' : 'Bought'} ${quantity*-1} at ${price} ${base}${special_msg}`
    renderTradePhoto(title, trade_datas.price, trade_datas.sell, trade_datas.buy)
    .then(res => {

    })
  } else if (messageObj.hasOwnProperty('book')) {
    const book = JSON.parse(JSON.stringify(messageObj.book));
    const findWhale = (bids) => {
      return bids
          .filter(bid => bid[2]*bid[0]*book.usd_price >= book.min_worth)
          .map(bid => {
            const zvalue = (+bid[2])*(+bid[0])*book.usd_price;
            return {
              x: +bid[0],  // price
              y: +bid[1],  // total
              z: zvalue/1000,  // quantity
              name: trade_datas.exchanges[exchange.toLowerCase()]
            };
          });
    };

    const calculateTotal = (bids) => {
      // Change structure to [price, total, quantity]
      bids.forEach((bid, idx) => {
        bids[idx][0] = +bids[idx][0];
        bids[idx][3] = +bids[idx][2]*bids[idx][0]*book.usd_price
        if (idx > 0) {
          bids[idx][2] = +bids[idx][1];
          bids[idx][1] = +bids[idx-1][1] + bids[idx][2];
        } else {
          bids[idx][1] = +bids[idx][1]
          bids[idx][2] = +bids[idx][1]
        }
      })
    }

    const foundInWhaleList = (p, q, whale) => {
      return whale.filter(w => w.x === +p && w.z === +q).length > 0
    }

    const addBigToWhale = (priceObject, bidsOrAsks, whaleObject) => {
      if (whaleObject.length > 0 && foundInWhaleList(priceObject[0], priceObject[1], whaleObject)) {
        console.log(`found Whale order ${priceObject[0]} ${priceObject[1]} in whale book`);
        return 0;
      }

      // Add to whaleBids
      const idx = bidsOrAsks.findIndex(bid => bid[0] === +priceObject[0]);
      if (idx < 0) {
        console.log(`Not found Whale order ${priceObject[0]} ${priceObject[1]} in book`);
        return 1;
      }
      const zvalue = (+priceObject[0])*(+priceObject[1])*book.usd_price;
      whaleObject.push({
        x: +bidsOrAsks[idx][0],  // price
        y: +bidsOrAsks[idx][1],  // total
        z: zvalue/1000,  // quantity
        name: trade_datas.exchanges[exchange.toLowerCase()]
      })
      return 0;
    }

    let asks = book.asks.slice().reverse();
    let bids = book.bids.slice();

    // whaleBids
    calculateTotal(asks);
    calculateTotal(bids);
    const whaleBids = findWhale(bids);
    const whaleAsks = findWhale(asks);
    asks.reverse();

    let error = 0;
    let title = 'Order chart';
    if (event == "VOLUME") {
      title = `Order of ${(+messageObj.type[1]).toFixed(2)} ${currency} placed at ${(+messageObj.type[0]).toFixed(2)} ${base}`;
                `Total ${messageObj.side} volume = ${quantity} ${currency}, which is around ${messageObj.size} times bigger than counterpart`;
      if (typeof messageObj.type == "object") {
        if (bids.length > 0 && messageObj.type[0] >= bids[0][0]) {
          error = addBigToWhale(messageObj.type, bids, whaleBids);
        } else if (asks.length > 0 && messageObj.type[0] <= asks[asks.length - 1][0]) {
          error = addBigToWhale(messageObj.type, asks, whaleAsks);
        }
      }
    }

    // Remove 2 last items
    asks = asks.map(ask => [ask[0], ask[1]]);
    bids = bids.map(bid => [bid[0], bid[1]]);

    // if (whaleAsks.length > 0 || whaleBids.length > 0 || error !== 0) {
    //   console.log(`FOUND Whale in book`);
    //   console.log(JSON.stringify({
    //     bids: bids,
    //     asks: asks,
    //     whaleBids: whaleBids,
    //     whaleAsks: whaleAsks
    //   }, null, "  "));
    // }

    if (whaleAsks.length > 0 || whaleBids.length > 0) {
      console.log(`WHALE bids: ${JSON.stringify(whaleBids, null, '  ')}`)
      console.log(`WHALE asks: ${JSON.stringify(whaleAsks, null, '  ')}`)
      renderOrderPhoto(title, bids, asks, whaleBids, whaleAsks)
      .then(res => {

      })
    }
    // DUMMY: don't send message
    const range_text = (asks) => {
      return (asks.length > 0) ?
            `${asks[0][0]} ~ ${asks[asks.length - 1][0]}` :
            '[]';
    }
    console.log(`DUMMY, no send ${event} and type ${messageObj.type} message: asks ${range_text(asks)}, bids ${range_text(bids)}`);
  }

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