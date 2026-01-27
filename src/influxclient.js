const { InfluxDB } = require('@influxdata/influxdb-client');

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || 'v6ee0uO-rWdzdnnnEOZuchHCk_ilunUEHLSmGMFbfJdud722YSSk12GIt6JHH2wqvt7CY50MeUkl1pexUY4EPw==';
const org = process.env.INFLUX_ORG || 'JPCDI';

const influxDB = new InfluxDB({ url, token });

module.exports = {
  influxDB,
  org,
};
