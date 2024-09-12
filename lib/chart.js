// Build whale chart
const request = require('request-promise-native');

const exportUrl = 'https://export.highcharts.com/';

// symbol: {
//   BTC-USD: {price, sell, buy}
// }
function renderTradePhoto(title, symbol, zsymbol = 'all') {
    const keys = zsymbol === 'all' ? Object.keys(symbol) : [zsymbol];
    const chartOptions = {
        method: 'POST',
        uri: exportUrl,
        body: {
            async: true,
            type: 'png',
            width: 768,
            options: {
                title: {text: title},
                xAxis: [{
                  type: 'datetime',
                  labels: {
                    autoRotation: [-10, -20, -30, -40, -50, -60, -70, -80, -90]
                  }
                }],
                yAxis: keys.map(k => {
                  return {
                    title: {
                      text: `Price ${k}`
                    },
                    lineWidth: 2
                  }
                }),
                plotOptions: {
                  bubble: {
                    dataLabels: {
                        enabled: true,
                        format: '{point.name}<br/>{point.z:,.0f}K'
                    }
                  }
                },
                series: keys.map((k, i) => {
                  return [
                  {
                    type: 'spline',
                    name: 'Price',
                    data: symbol[k].price,
                    yAxis: i
                  },
                  {
                    type: 'bubble',
                    name: 'Sell',
                    data: symbol[k].sell,
                    color: '#f84960',
                    yAxis: i
                  },
                  {
                    type: 'bubble',
                    name: 'Buy',
                    data: symbol[k].buy,
                    color: '#02c077',
                    yAxis: i
                  }]
                }).flat()
            }
        },
        json: true
    };

    // console.log(JSON.stringify(chartOptions, null, '  '));

    return request(chartOptions)
    .then(function (res) {
        console.log(exportUrl + res);        
        return exportUrl + res;
    })
    .catch(function (err) {
        console.log("Main:", err.message);
    })
}

function renderOrderPhoto(title, bids, asks, whaleBids, whaleAsks) {
  const chartOptions = {
    method: 'POST',
    uri: exportUrl,
    body: {
        async: true,
        type: 'png',
        width: 768,
        options: {
          title: {text: title},
          xAxis: {
            minPadding: 0,
            maxPadding: 0,
            plotLines: [{
              color: '#888',
              value: 0.1523,
              width: 1,
              label: {
                  text: 'Actual price',
                  rotation: 90
              }
            }],
            title: {
                text: 'Price'
            }
          },
        yAxis: [{
          lineWidth: 1,
          gridLineWidth: 1,
          title: null,
          tickWidth: 1,
          tickLength: 5,
          tickPosition: 'inside',
          labels: {
              align: 'left',
              x: 8
          }
        }, {
          opposite: true,
          lineWidth: 1,
          linkedTo: 0,
          gridLineWidth: 0,
          title: null,
          tickWidth: 1,
          tickLength: 5,
          tickPosition: 'inside',
          labels: {
              align: 'right',
              x: -8
          }
        }],
        legend: {
          enabled: false
        },
        plotOptions: {
          area: {
              marker: {
                enabled: false
              },
              fillOpacity: 0.2,
              lineWidth: 1,
              step: 'center'
          },
          bubble: {
              dataLabels: {
                  enabled: true,
                  format: '{point.name}<br/>{point.z:,.0f}K'
              }
          }
        },
        series: [{
          type: 'area',
          name: 'Bids',
          data: bids,
          color: '#fc5857',
        }, {
          type: 'area',
          name: 'Asks',
          data: asks,
          color: '#03a7a8',
        },
        {
          type: 'bubble',
          name: 'Bids',
          data: whaleBids,
          color: '#999999',
        },
        {
          type: 'bubble',
          name: 'Asks',
          data: whaleAsks,
          color: '#55FF55',
        }]
      }
    },
    json: true
  }

  // console.log(JSON.stringify(chartOptions, null, '  '));
  return request(chartOptions)
    .then(function (res) {
        console.log(exportUrl + res);        
        return exportUrl + res;
    })
    .catch(function (err) {
        console.log("Main:", err.message);
    })
}

module.exports = {renderTradePhoto, renderOrderPhoto};
