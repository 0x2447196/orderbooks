const EventEmitter = require('events');
const WebSocket = require('ws');
const axios = require('axios');

class OrderBook extends EventEmitter {
  constructor() {
    super();
    this.book = {
      bids: {},
      asks: {}
    };
  }

  update(side, p, q) {
    const price = parseFloat(p);
    const quantity = parseFloat(q);

    if (quantity === 0) {
      delete this.book[side][price];
    } else {
      this.book[side][price] = quantity;
    }

    this.emit('update', {price, quantity})
  }

  clear() {
    this.book = { bids: {}, asks: {} };
  }

   getTopLevels(n=5) {
    const topBids = Object.keys(this.book.bids)
      .sort((a, b) => b - a)
      .slice(0, n)
      .map(price => ({ price, quantity: this.book.bids[price] }));

    const topAsks = Object.keys(this.book.asks)
      .sort((a, b) => a - b)
      .slice(0, n)
      .map(price => ({ price, quantity: this.book.asks[price] }));

    return { topBids, topAsks }
  }

  getBookPressure(n=5) {
    const {topBids, topAsks} = this.getTopLevels(n);
    let weightedSumBids = 0;
    let totalVolumeBids = 0;
    topBids.forEach(({ price, quantity }) => {
      weightedSumBids += parseFloat(price)*quantity;
      totalVolumeBids += quantity;
    })

    let weightedSumAsks = 0;
    let totalVolumeAsks = 0;
    topAsks.forEach(({ price, quantity }) => {
      weightedSumAsks += parseFloat(price)*quantity;
      totalVolumeAsks += quantity;
    })

    return (weightedSumBids + weightedSumAsks) / (totalVolumeBids + totalVolumeAsks)

  }
}

class Binance {
  constructor(symbol, orderBook) {
    this.symbol = symbol;
    this.wsEndpoint = `wss://fstream.binance.com/stream?streams=${symbol}@depth`;
    this.restEndpoint = `https://fapi.binance.com/fapi/v1/depth?symbol=${symbol.toUpperCase()}&limit=1000`;

    this.orderBook = orderBook;
    this.eventBuffer = [];
    this.lastUpdateId = 0;
    this.pruned = false;
    this.prevEventU = null;

    this.ws = null;

    this.setupWebSocket = this.setupWebSocket.bind(this);
    this.fetchDepthSnapshot = this.fetchDepthSnapshot.bind(this);
    this.handleWebSocketMessage = this.handleWebSocketMessage.bind(this);
    this.handleWebSocketError = this.handleWebSocketError.bind(this);
    this.handleWebSocketClose = this.handleWebSocketClose.bind(this);
    this.reconnectWebSocket = this.reconnectWebSocket.bind(this);
    this.start = this.start.bind(this);
  }

  async fetchDepthSnapshot() {
    try {
      this.pruned = false;
      const response = await axios.get(this.restEndpoint);
      const snapshot = response.data;
      this.lastUpdateId = snapshot.lastUpdateId;
      console.log('Depth snapshot fetched');
    } catch (error) {
      console.error('Error fetching depth snapshot:', error);
      process.exit(1)

    }
  }

  processBufferedEvents() {
    if (!this.pruned) {
      let event = this.eventBuffer[0];
      while(this.eventBuffer.length && !(event.U <= this.lastUpdateId + 1 && event.u >= this.lastUpdateId + 1)) {
        event = this.eventBuffer.shift();
      }

      this.pruned = true;
    }

    while (this.eventBuffer.length) {
      const event = this.eventBuffer.shift();
      this.updateOrderBookFromEvent(event);
    }
  }

  updateOrderBookFromEvent(event) {
    this.lastUpdateId = event.u;
  
    for (const bid of event.b) {
      this.orderBook.update('bids', bid[0], bid[1]);
    }
  
    for (const ask of event.a) {
      this.orderBook.update('asks', ask[0], ask[1]);
    }
  }

  handleWebSocketMessage = (message) => {
    const event = JSON.parse(message);
    if (!event.stream.endsWith("@depth")) {
      console.log(`got data for stream: ${event.stream}`)
      return;
    }

    if(this.prevEventU === null || event.pu === this.prevEventU){
      this.prevEventU = event.u;
      this.eventBuffer.push(event.data);
      this.processBufferedEvents();
    } else {
      console.log('Reinitializing due to a sequence mismatch in the WebSocket feed');
      this.prevEventU = null;
      this.orderBook.clear();
      this.eventBuffer = [];
      this.fetchDepthSnapshot().then(this.reconnectWebSocket);
    }
  }

  handleWebSocketError = (error) => {
    console.error('WebSocket error:', error);
  }

  handleWebSocketClose = () => {
    console.log('WebSocket closed');
    this.reconnectWebSocket();
  }

  async reconnectWebSocket() {
    console.log('Reconnecting to WebSocket...');
    this.setupWebSocket();
    this.fetchDepthSnapshot();
  }

  setupWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  
    this.ws = new WebSocket(this.wsEndpoint);
    this.ws.on('message', this.handleWebSocketMessage);
    this.ws.on('error', this.handleWebSocketError);
    this.ws.on('close', this.handleWebSocketClose);
  }

  start() {
    this.setupWebSocket();
    this.fetchDepthSnapshot();
  }
}

const orderBook = new OrderBook();
const binance = new Binance('1000pepeusdt', orderBook);
binance.orderBook.on('update', (item) => {
  // console.log(binance.orderBook.book)
  const bP = binance.orderBook.getBookPressure();
  process.stdout.write(`book pressure: ${bP.toFixed(7)}\r`);
});
binance.start();


const binance2 = new Binance('btcusdt', new OrderBook());
binance2.orderBook.on('update', (item) => {
  // console.log(binance.orderBook.book)
  const bP = binance.orderBook.getBookPressure();
  process.stdout.write(`book pressure: ${bP.toFixed(4)}\r`);
});
// binance2.start();

