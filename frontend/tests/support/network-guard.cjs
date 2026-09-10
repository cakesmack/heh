'use strict';

const dns = require('node:dns');
const fs = require('node:fs');
const net = require('node:net');

const BUILD_FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const allowedExternalHosts =
  process.env.FRONTEND_NETWORK_POLICY === 'google-font-build' ? BUILD_FONT_HOSTS : new Set();
const logPath = process.env.FRONTEND_NETWORK_LOG;

function normalizeHost(host) {
  return typeof host === 'string' ? host.toLowerCase().replace(/^\[|\]$/g, '') : '';
}

function isLoopbackHost(host) {
  const normalized = normalizeHost(host);
  if (normalized === 'localhost' || normalized === '::1') return true;
  if (net.isIPv4(normalized)) return Number(normalized.split('.')[0]) === 127;
  return false;
}

function record(decision, operation, host) {
  if (!logPath) return;
  const entry = JSON.stringify({ decision, operation, host: normalizeHost(host), pid: process.pid });
  fs.appendFileSync(logPath, `${entry}\n`, 'utf8');
}

function classifyExternalHost(host, operation) {
  if (isLoopbackHost(host)) return;
  const normalized = normalizeHost(host);
  if (allowedExternalHosts.has(normalized)) {
    record('allowed', operation, normalized);
    return;
  }
  record('blocked', operation, normalized || '<unspecified>');
  const error = new Error(`FRONTEND_VERIFICATION_NETWORK_BLOCKED ${operation} ${normalized || '<unspecified>'}`);
  error.code = 'FRONTEND_VERIFICATION_NETWORK_BLOCKED';
  throw error;
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const first = args[0];
  if (typeof first === 'string') return originalConnect.apply(this, args);

  let host;
  if (typeof first === 'object' && first !== null) {
    if (first.path) return originalConnect.apply(this, args);
    host = first.host || 'localhost';
  } else if (typeof first === 'number') {
    host = typeof args[1] === 'string' ? args[1] : 'localhost';
  }

  classifyExternalHost(host, 'connect');
  return originalConnect.apply(this, args);
};

const originalLookup = dns.lookup;
dns.lookup = function guardedLookup(hostname, ...args) {
  try {
    classifyExternalHost(hostname, 'dns.lookup');
  } catch (error) {
    const callback = args.find((arg) => typeof arg === 'function');
    if (callback) {
      process.nextTick(callback, error);
      return;
    }
    throw error;
  }
  return originalLookup.call(this, hostname, ...args);
};

if (dns.promises?.lookup) {
  const originalPromisesLookup = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = async function guardedPromisesLookup(hostname, ...args) {
    classifyExternalHost(hostname, 'dns.promises.lookup');
    return originalPromisesLookup(hostname, ...args);
  };
}
