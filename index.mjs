import { OrderBook } from "./lib/orderbook.mjs"
import { BinanceOrderbook } from "./lib/binance_orderbook.mjs"

const binance = new BinanceOrderbook('1000pepeusdt', new OrderBook());
binance.orderBook.on('update', (item) => {
  const bP = binance.orderBook.getBookPressure();
  process.stdout.write(`book pressure: ${bP.toFixed(7)}\r`);
});
binance.start();
