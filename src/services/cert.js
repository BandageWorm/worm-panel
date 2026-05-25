const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

const SSL_DIR = path.join(__dirname, '..', '..', 'data', 'ssl');
const KEY_PATH = path.join(SSL_DIR, 'key.pem');
const CERT_PATH = path.join(SSL_DIR, 'cert.pem');

function ensureDir() {
  if (!fs.existsSync(SSL_DIR)) {
    fs.mkdirSync(SSL_DIR, { recursive: true });
  }
}

function exists() {
  return fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
}

function generate() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);
  const attrs = [
    { name: 'commonName', value: 'localhost' },
    { name: 'organizationName', value: 'WormPanel' },
    { name: 'countryName', value: 'CN' }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', keyCertSign: true, digitalSignature: true, keyEncipherment: true },
    { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
    { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }] }
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  const certPem = forge.pki.certificateToPem(cert);

  ensureDir();
  fs.writeFileSync(KEY_PATH, keyPem, 'utf8');
  fs.writeFileSync(CERT_PATH, certPem, 'utf8');

  return { key: keyPem, cert: certPem };
}

function get() {
  if (exists()) {
    return {
      key: fs.readFileSync(KEY_PATH, 'utf8'),
      cert: fs.readFileSync(CERT_PATH, 'utf8')
    };
  }
  return generate();
}

module.exports = { generate, get };
