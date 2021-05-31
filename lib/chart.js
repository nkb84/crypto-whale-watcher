// Build whale chart
const request = require('request-promise-native');

const exportUrl = 'https://export.highcharts.com/';

function renderTradePhoto(title, price, sell, buy) {
    const chartOptions = {
        method: 'POST',
        uri: exportUrl,
        body: {
            async: true,
            type: 'png',
            width: 768,
            options: {
                title: {text: title},
                yAxis: [{
                    title: {
                      text: 'Price'
                    },
                    lineWidth: 2
                  }],
                plotOptions: {
                  series: {
                    dataLabels: {
                        enabled: true,
                        format: '{point.name}<br/>{point.z:,.0f}K'
                    }
                  }
                },
                series: [{
                    type: 'spline',
                    name: 'Price',
                    data: price,
                  },
                  {
                    type: 'bubble',
                    name: 'Sell',
                    data: sell,
                    color: '#999999'
                  },
                  {
                    type: 'bubble',
                    name: 'Buy',
                    data: buy,
                    color: '#55FF55'
                  }]
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
          color: '#03a7a8',
          yAxis: 0
        }, {
          type: 'area',
          name: 'Asks',
          data: asks,
          color: '#fc5857',
          yAxis: 0
        },
        {
          type: 'bubble',
          name: 'Bids',
          data: whaleBids,
          color: '#999999',
          yAxis: 0
        },
        {
          type: 'bubble',
          name: 'Asks',
          data: whaleAsks,
          color: '#55FF55',
          yAxis: 0
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