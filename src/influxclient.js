const { InfluxDB } = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUXDB_TOKEN;
const org = process.env.INFLUX_ORG || 'JPCDI';

const influxDB = new InfluxDB({ url, token });

module.exports = {
  influxDB,
  org,
};
