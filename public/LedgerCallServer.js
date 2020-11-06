// var JSAlert = require('js-alert');
const express = require('express')
const cors = require('cors')
const app = express()
const TransportNodeHid = require('@ledgerhq/hw-transport-node-hid')
const { SymbolLedger } = require('./ledger.model')
const { NetworkType } = require('symbol-sdk')
const Port = 6789;

// Enable preflight requests for all routes

app.use(cors());

// Replace if using a different env file or config
// const env = require("dotenv").config({ path: "./.env" });

app.use(
  express.json({
    // We need the raw body to verify webhook signatures.
    verify: function (req, res, buf) {
      if (req.originalUrl.startsWith('/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  }),
);

// app.use(cors(corsOptions));

async function account(req, res) {
  try {
    const { currentPath, networkType, display } = req.body;
    const transport = await TransportNodeHid['default'].open('');
    const symbolLedger = new SymbolLedger(transport, 'XYM');
    const accountResult = await symbolLedger.getAccount(currentPath, NetworkType.TEST_NET, false);
    const { /*address,*/ publicKey, /*path*/ } = accountResult;
    transport.close();
    res.send({/* address,*/ publicKey, /*path*/ });
  } catch (error) {
    res.send(error);
    console.error(error);
  }
}

async function sign(req, res) {
  const { path, transferTransaction, networkGenerationHash, signerPublicKey } = req.body;
  const transport = await TransportNodeHid['default'].create();
  const symbolLedger = new SymbolLedger(transport, 'XYM');
  const signedTransaction = await symbolLedger.signTransaction(path, transferTransaction, networkGenerationHash, signerPublicKey);

  const { payload, transactionHash } = signedTransaction;
  transport.close();
  res.send({ payload, transactionHash, signerPublicKey });
}

async function signCosignatureTransaction(req, res) {
  const { path, cosignatureTransaction, signerPublicKey } = req.body;
  const transport = await TransportNodeHid['default'].create();
  const symbolLedger = new SymbolLedger(transport, 'XYM');
  const signedTransaction = await symbolLedger.signCosignatureTransaction(
    path,
    cosignatureTransaction,
    signerPublicKey,
  );
  const { signature } = signedTransaction;
  transport.close();
  res.send({ signature, signerPublicKey });
}

app.post('/ledger/account', async (req, res) => {
  account(req, res);
});
app.post('/ledger/sign', async (req, res) => {
  sign(req, res);
});
app.post('/ledger/signCosignature', async (req, res) => {
  signCosignatureTransaction(req, res);
});

app.listen(Port, () => console.log(`Node server listening on port ${Port}!`));

