import EventEmitter from 'events';

export class OrderBook extends EventEmitter {
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

