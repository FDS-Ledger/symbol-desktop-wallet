import { DerivationPathValidator } from '@/core/validation/validators';
import { SymbolLedger } from '@/core/utils/Ledger';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
const TransportNodeHid = window['TransportNodeHid'] && window['TransportNodeHid'].default;

export class LedgerService {
    private transport;

    private async getTransport() {
        return TransportNodeHid ? await TransportNodeHid.open() : await TransportWebUSB.create();
    }

    private async closeTransport() {
        TransportNodeHid && this.transport && await this.transport.close();
    }

    private formatError(error) {
        return error.statusCode || error.id ? { errorCode: error.statusCode || error.id } : error;
    }

    public async isAppSupported() {
        try {
            const transport = await this.getTransport();
            const symbolLedger = new SymbolLedger(transport, 'XYM');
            const result = await symbolLedger.isAppSupported();
            await this.closeTransport();
            return result;
        } catch (error) {
            await this.closeTransport();
            throw this.formatError(error);
        }
    }

    public async getAccount(path: string, networkType: number, display: boolean) {
        try {
            if (false === DerivationPathValidator.validate(path)) {
                const errorMessage = 'Invalid derivation path: ' + path;
                throw new Error(errorMessage);
            }
            const transport = await this.getTransport();
            const symbolLedger = new SymbolLedger(transport, 'XYM');
            const result = await symbolLedger.getAccount(path, networkType, display);
            await this.closeTransport();
            return result;
        } catch (error) {
            await this.closeTransport();
            throw this.formatError(error);
        }
    }

    public async signTransaction(path: string, transferTransaction: any, networkGenerationHash: string, signerPublicKey: string) {
        try {
            if (false === DerivationPathValidator.validate(path)) {
                const errorMessage = 'Invalid derivation path: ' + path;
                throw new Error(errorMessage);
            }
            const transport = await this.getTransport();
            const symbolLedger = new SymbolLedger(transport, 'XYM');
            const result = await symbolLedger.signTransaction(path, transferTransaction, networkGenerationHash, signerPublicKey);
            await this.closeTransport();
            return result;
        } catch (error) {
            await this.closeTransport();
            throw this.formatError(error);
        }
    }

    public async signCosignatureTransaction(path: string, cosignatureTransaction: any, signerPublicKey: string) {
        try {
            if (false === DerivationPathValidator.validate(path)) {
                const errorMessage = 'Invalid derivation path: ' + path;
                throw new Error(errorMessage);
            }
            const transport = await this.getTransport();
            const symbolLedger = new SymbolLedger(transport, 'XYM');
            const result = await symbolLedger.signCosignatureTransaction(path, cosignatureTransaction, signerPublicKey);
            await this.closeTransport();
            return result;
        } catch (error) {
            await this.closeTransport();
            throw this.formatError(error);
        }
    }
}
