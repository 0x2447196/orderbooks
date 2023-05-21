import { OrderBook } from "./lib/orderbook.mjs"
import { BinanceOrderbook } from "./lib/binance_orderbook.mjs"

const symbol = process.argv[2] || 'btcusdt'; 
const binance = new BinanceOrderbook(symbol, new OrderBook());

binance.orderBook.on('update', (item) => {
  const bP = binance.orderBook.getBookPressure();
  process.stdout.write(`book pressure: ${bP.toFixed(7)}\r`);
});

binance.start();
