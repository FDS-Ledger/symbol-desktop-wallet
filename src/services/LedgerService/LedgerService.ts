import { SignedTransaction, CosignatureSignedTransaction } from 'symbol-sdk';
// @ts-ignore

export class LedgerService {
    async isAppSupported() {

        const host = 'http://localhost:6789';
        try {
            const result = await fetch(host + '/ledger/isAppSupported/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },

            });
            const data = await result.json();
            const { isAppSupported } = data;
            return { isAppSupported };
        } catch {
            console.log('Please ensure that your device is opening with ledger-bolos-app!');
        }
    }

    async getAccount(currentPath: string, networkType: number, display: boolean) {
        const param = {
            currentPath,
            networkType,
            display
        };
        const host = 'http://localhost:6789';
        try {
            const result = await fetch(host + '/ledger/account/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(param),
            });
            const data = await result.json();
            const { /*address,*/ publicKey, /*path*/ } = data;
            return { /*address,*/ publicKey, /*path*/ };
        } catch {
            console.log('Please ensure that your device is opening with ledger-bolos-app!');
        }
    }

    async signTransaction(path: string, transferTransaction: any, networkGenerationHash: string, signerPublicKey: string) {
        const param = {
            path,
            transferTransaction: {
                ...transferTransaction.toJSON(),
                serialize: transferTransaction.serialize()
            },
            networkGenerationHash,
            signerPublicKey
        };
        console.log(param.transferTransaction)

        const host = 'http://localhost:6789';
        const result = await fetch(host + '/ledger/sign/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(param),
        });

        const data = await result.json();
        const signedTransaction = new SignedTransaction(
            data.payload,
            data.transactionHash,
            data.signerPublicKey,
            transferTransaction.type,
            transferTransaction.networkType,
        );
        console.log('signedTransaction in sevice', signedTransaction)
        return signedTransaction;
    }

    async signCosignatureTransaction(path: string, cosignatureTransaction: any, signerPublicKey: string) {
        const transactionHash = cosignatureTransaction.transactionInfo.hash;
        const param = {
            path,
            cosignatureTransaction:  {
                ...cosignatureTransaction.toJSON(),
                serialize: cosignatureTransaction.serialize()
            },
            signerPublicKey
        };

        const host = 'http://localhost:6789';
        const result = await fetch(host + '/ledger/signCosignature/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(param),
        });

        const data = await result.json();
        const signedTransaction = new CosignatureSignedTransaction(transactionHash, data.signature, data.signerPublicKey);

        return signedTransaction;
    }
}

