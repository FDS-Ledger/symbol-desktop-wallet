import { SignedTransaction, CosignatureSignedTransaction } from 'symbol-sdk';
// @ts-ignore

export class LedgerService {
    async isAppSupported() {
        try {
            const host = 'http://localhost:6789';
            const result = await fetch(host + '/ledger/isAppSupported/', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },

            });
            const data = await result.json();
            // handle error code
            if (data.statusCode || data.id) {
                throw ({ errorCode: data.statusCode || data.id })
            }
            const { isAppSupported } = data;
            return { isAppSupported };

        } catch (error) {
            throw error.errorCode ? error : { errorCode: 'bridge_problem' }
        }
    }

    async getAccount(currentPath: string, networkType: number, display: boolean) {
        const param = {
            currentPath,
            networkType,
            display
        };
        try {
            const host = 'http://localhost:6789';
            const result = await fetch(host + '/ledger/account/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(param),
            });
            const data = await result.json();
            // handle error code
            if (data.statusCode || data.id) {
                throw ({ errorCode: data.statusCode || data.id })
            }
            const { /*address,*/ publicKey, /*path*/ } = data;
            return { /*address,*/ publicKey, /*path*/ };

        } catch (error) {
            throw error.errorCode ? error : { errorCode: 'bridge_problem' }
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
        try {
            const host = 'http://localhost:6789';
            const result = await fetch(host + '/ledger/sign/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(param),
            });

            const data = await result.json();
            // handle error code
            if (data.statusCode || data.id) {
                throw ({ errorCode: data.statusCode || data.id })
            }
            const signedTransaction = new SignedTransaction(
                data.payload,
                data.transactionHash,
                data.signerPublicKey,
                transferTransaction.type,
                transferTransaction.networkType,
            );
            return signedTransaction;

        } catch (error) {
            throw error.errorCode ? error : { errorCode: 'bridge_problem' }
        }
    }

    async signCosignatureTransaction(path: string, cosignatureTransaction: any, signerPublicKey: string) {
        const transactionHash = cosignatureTransaction.transactionInfo.hash;
        const param = {
            path,
            cosignatureTransaction: {
                transaction: { hash: transactionHash },
                serialize: cosignatureTransaction.serialize()
            },
            signerPublicKey
        };
        try {
            const host = 'http://localhost:6789';
            const result = await fetch(host + '/ledger/signCosignature/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(param),
            });

            const data = await result.json();
            // handle error code
            if (data.statusCode || data.id) {
                throw ({ errorCode: data.statusCode || data.id })
            }
            const signedTransaction = new CosignatureSignedTransaction(transactionHash, data.signature, data.signerPublicKey);
            return signedTransaction;
            
        } catch (error) {
            throw error.errorCode ? error : { errorCode: 'bridge_problem' }
        }
    }
}

