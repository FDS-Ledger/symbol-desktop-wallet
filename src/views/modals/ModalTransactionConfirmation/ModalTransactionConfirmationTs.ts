/*
 * Copyright 2020 NEM (https://nem.io)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations under the License.
 *
 */
import { Component, Prop, Vue } from 'vue-property-decorator';
import { mapGetters } from 'vuex';
import {
    Account,
    Transaction,
    MosaicId,
    MultisigAccountInfo,
    NetworkType,
    PublicAccount,
    TransactionFees,
    Address,
    SignedTransaction,
    AggregateTransaction,
    Deadline,
    LockFundsTransaction,
    Mosaic,
    UInt64,
} from 'symbol-sdk';
import { ProfileModel } from '@/core/database/entities/ProfileModel';
import { ValidationObserver } from 'vee-validate';
import { Signer } from '@/store/Account';
import { NetworkCurrencyModel } from '@/core/database/entities/NetworkCurrencyModel';
import { TransactionCommand, TransactionCommandMode } from '@/services/TransactionCommand';
import { NetworkConfigurationModel } from '@/core/database/entities/NetworkConfigurationModel';
// @ts-ignore
import { Observable, of } from 'rxjs';
import { AccountService } from '@/services/AccountService';
// internal dependencies
import { AccountModel, AccountType } from '@/core/database/entities/AccountModel';
import { AccountTransactionSigner, TransactionAnnouncerService, TransactionSigner } from '@/services/TransactionAnnouncerService';
// child components
// @ts-ignore
import TransactionDetails from '@/components/TransactionDetails/TransactionDetails.vue';
// @ts-ignore
import FormProfileUnlock from '@/views/forms/FormProfileUnlock/FormProfileUnlock.vue';
// @ts-ignore
import HardwareConfirmationButton from '@/components/HardwareConfirmationButton/HardwareConfirmationButton.vue';

@Component({
    components: {
        TransactionDetails,
        FormProfileUnlock,
        HardwareConfirmationButton,
    },
    computed: {
        ...mapGetters({
            currentAccount: 'account/currentAccount',
            generationHash: 'network/generationHash',
            networkType: 'network/networkType',
            defaultFee: 'app/defaultFee',
            currentProfile: 'profile/currentProfile',
            selectedSigner: 'account/currentSigner',
            currentSignerPublicKey: 'account/currentSignerPublicKey',
            currentSignerAddress: 'account/currentSignerAddress',
            currentSignerMultisigInfo: 'account/currentSignerMultisigInfo',
            currentAccountMultisigInfo: 'account/currentAccountMultisigInfo',
            isCosignatoryMode: 'account/isCosignatoryMode',
            networkMosaic: 'mosaic/networkMosaic',
            networkCurrency: 'mosaic/networkCurrency',
            signers: 'account/signers',
            networkConfiguration: 'network/networkConfiguration',
            transactionFees: 'network/transactionFees',
        }),
    },
})
export class ModalTransactionConfirmationTs extends Vue {
    @Prop({
        default: false,
    })
    public visible: boolean;

    @Prop({
        required: true,
    })
    public command: TransactionCommand;
    public generationHash: string;

    /**
     * Network type
     * @var {NetworkType}
     */
    public networkType: NetworkType;

    /**
     * Default fee setting
     */
    public defaultFee: number;

    /**
     * Currently active signer
     */
    public selectedSigner: Signer;

    /**
     * Currently active signer's public key
     */
    public currentSignerPublicKey: string;

    /**
     * Currently active signer's address
     */
    public currentSignerAddress: Address;

    /**
     * Current account multisig info
     * @type {MultisigAccountInfo}
     */
    public currentAccountMultisigInfo: MultisigAccountInfo;

    /**
     * Current signer multisig info
     * @var {MultisigAccountInfo}
     */
    public currentSignerMultisigInfo: MultisigAccountInfo;

    /**
     * Whether the form is in cosignatory mode (cosigner selected)
     * @var {boolean}
     */
    public isCosignatoryMode: boolean;

    /**
     * Networks currency mosaic
     * @var {MosaicId}
     */
    public networkMosaic: MosaicId;

    /**
     * Whether the form is currently awaiting a signature
     * @var {boolean}
     */
    public isAwaitingSignature: boolean = false;
    /**
     * Public key of the current signer
     * @var {any}
     */
    public currentProfile: ProfileModel;

    public currentSigner: PublicAccount;

    public signers: Signer[];

    public networkCurrency: NetworkCurrencyModel;

    public networkConfiguration: NetworkConfigurationModel;

    protected transactionFees: TransactionFees;

    /**
     * Type the ValidationObserver refs
     * @type {{
     *     observer: InstanceType<typeof ValidationObserver>
     *   }}
     */
    public $refs!: {
        observer: InstanceType<typeof ValidationObserver>;
    };
    get hasConfirmationModal(): boolean {
        return this.isAwaitingSignature;
    }

    set hasConfirmationModal(f: boolean) {
        this.isAwaitingSignature = f;
    }
    /**
     * Currently active account
     * @see {Store.Account}
     * @var {AccountModel}
     */
    public currentAccount: AccountModel;

    /**
     * List of transactions on-stage
     * @see {Store.Account}
     * @var {Transaction[]}
     */
    public stagedTransactions: Transaction[] = [];
    /**
     * Getter for whether forms should aggregate transactions in BONDED
     * @return {boolean}
     */
    protected isMultisigMode(): boolean {
        return this.isCosignatoryMode === true;
    }

    public async mounted() {
        this.stagedTransactions = await this.command.resolveTransactions().toPromise();
    }
    /**
     * Reset the form with properties
     * @throws {Error} If not overloaded in derivate component
     */
    protected resetForm() {
        throw new Error("Method 'resetForm()' must be overloaded in derivate components.");
    }
    /**
     * Getter for transactions that will be staged
     * @throws {Error} If not overloaded in derivate component
     */
    protected getTransactions(): Transaction[] {
        throw new Error("Getter method 'getTransactions()' must be overloaded in derivate components.");
    }
    protected getTransactionCommandMode(transactions: Transaction[]): TransactionCommandMode {
        if (this.isMultisigMode()) {
            return TransactionCommandMode.MULTISIGN;
        }
        if (transactions.length > 1) {
            return TransactionCommandMode.AGGREGATE;
        } else {
            return TransactionCommandMode.SIMPLE;
        }
    }
    public createTransactionCommand(): TransactionCommand {
        const transactions = this.getTransactions();
        const mode = this.getTransactionCommandMode(transactions);
        return new TransactionCommand(
            mode,
            this.selectedSigner,
            this.currentSignerPublicKey,
            transactions,
            this.networkMosaic,
            this.generationHash,
            this.networkType,
            this.networkConfiguration,
            this.transactionFees,
            this.currentSignerMultisigInfo!! ? this.currentSignerMultisigInfo.minApproval : this.selectedSigner.requiredCosignatures,
        );
    }
    /**
     * Setter for transactions that will be staged
     * @param {Transaction[]} transactions
     * @throws {Error} If not overloaded in derivate component
     */
    protected setTransactions(transactions: Transaction[]) {
        //TODO do we need these methods?
        const error = `setTransactions() must be overloaded. Call got ${transactions.length} transactions.`;
        throw new Error(error);
    }

    /// region computed properties getter/setter
    /**
     * Returns whether current account is a hardware wallet
     * @return {boolean}
     */
    public get isUsingHardwareWallet(): boolean {
        // XXX should use "stagedTransaction.signer" to identify account
        return AccountType.LEDGER === this.currentAccount.type || AccountType.TREZOR === this.currentAccount.type ? true : false;
    }

    /**
     * Visibility state
     * @type {boolean}
     */
    public get show(): boolean {
        return this.visible;
    }

    /**
     * Emits close event
     */
    public set show(val) {
        if (!val) {
            this.$emit('close');
        }
    }
    /// end-region computed properties getter/setter

    /**
     * Hook called when child component FormProfileUnlock emits
     * the 'success' event.
     *
     * This hook shall *sign transactions* with the \a account
     * that has been unlocked. Subsequently it will also announce
     * the signed transaction.
     *
     */
    public async onAccountUnlocked({ account }: { account: Account }): Promise<void> {
        // - log about unlock success
        this.$store.dispatch('diagnostic/ADD_INFO', `Account ${account.address.plain()} unlocked successfully.`);
        // - get transaction stage config
        return this.onSigner(new AccountTransactionSigner(account));
    }

    /**
     * Hook called when child component FormProfileUnlock emits
     * the 'success' event.
     *
     * This hook shall *sign transactions* with the \a account
     * that has been unlocked. Subsequently it will also announce
     * the signed transaction.
     *
     */
    public async onSigner(transactionSigner: TransactionSigner): Promise<void> {
        // - log about unlock success
        // - get transaction stage config
        if (
            AccountType.SEED === this.currentAccount.type ||
            AccountType.PRIVATE_KEY === this.currentAccount.type ||
            AccountType.KEYSTORE === this.currentAccount.type
        ) {
            const announcements = await this.command.announce(new TransactionAnnouncerService(this.$store), transactionSigner).toPromise();
            announcements.forEach((announcement) => {
                announcement.subscribe((res) => {
                    if (!res.success) {
                        this.$store.dispatch('notification/ADD_ERROR', res.error, { root: true });
                    }
                });
            });
            // - notify about successful transaction announce
            this.$store.dispatch('notification/ADD_SUCCESS', 'success_transactions_signed');
            this.$emit('success');
            this.show = false;
        } else {
            try {
                const currentPath = this.currentAccount.path;
                const networkType = this.currentProfile.networkType;
                const accountService = new AccountService();
                const signerPublicKey = await accountService.getLedgerPublicKeyByPath(networkType, currentPath);
                const symbolLedger = await accountService.getSimpleLedger(currentPath);
                // const accountResult = await symbolLedger.getAccount(currentPath, networkType, false)
                const publicKey = signerPublicKey;
                const ledgerAccount = PublicAccount.createFromPublicKey(publicKey.toUpperCase(), networkType);
                // this.command = this.createTransactionCommand();
                const multisigAccount = PublicAccount.createFromPublicKey(this.command.signerPublicKey, this.networkType);
                const stageTransactions = this.command.stageTransactions;
                const maxFee = stageTransactions.sort((a, b) => a.maxFee.compare(b.maxFee))[0].maxFee;
                // - open signature modal

                const txMode = this.command.mode;
                if (txMode == 'SIMPLE') {
                    stageTransactions.map(async (t) => {
                        const transaction = this.command.calculateSuggestedMaxFeeLedger(t);
                        await symbolLedger
                            .signTransaction(currentPath, transaction, this.generationHash, ledgerAccount.publicKey)
                            .then((res) => {
                                // - notify about successful transaction announce
                                if (res.hash) {
                                    this.$store.dispatch('notification/ADD_SUCCESS', 'success_transactions_signed');
                                    this.$emit('success');
                                    this.onConfirmationSuccess();
                                    const services = new TransactionAnnouncerService(this.$store);
                                    services.announce(res);
                                    this.show = false;
                                } else {
                                    if (res.statusCode == '26368') {
                                        this.$Notice.error({
                                            title: this['$t']('The transaction is too long!') + '',
                                        });
                                        this.show = false;
                                    } else {
                                        this.$Notice.error({
                                            title: this['$t'](res.message) + '',
                                        });
                                        this.show = false;
                                    }
                                }
                            })
                            .catch((err) => {
                                this.$Notice.error({
                                    title: this['$t'](err.message) + '',
                                });
                                this.show = false;
                            });
                    });
                } else if (txMode == 'AGGREGATE') {
                    const aggregate = this.command.calculateSuggestedMaxFeeLedger(
                        AggregateTransaction.createComplete(
                            Deadline.create(),
                            stageTransactions.map((t) => t.toAggregate(multisigAccount)),
                            this.networkType,
                            [],
                            maxFee,
                        ),
                    );

                    await symbolLedger
                        .signTransaction(currentPath, aggregate, this.generationHash, ledgerAccount.publicKey)
                        .then((res) => {
                            // - notify about successful transaction announce
                            this.$store.dispatch('notification/ADD_SUCCESS', 'success_transactions_signed');
                            this.$emit('success');
                            this.onConfirmationSuccess();
                            const services = new TransactionAnnouncerService(this.$store);
                            services.announce(res);
                            this.show = false;
                        })
                        .catch((err) => {
                            console.error(err);
                            this.$Notice.error({
                                title: this['$t']('Transaction cancel!') + '',
                            });
                            this.show = false;
                        });
                } else {
                    const aggregate = this.command.calculateSuggestedMaxFeeLedger(
                        AggregateTransaction.createBonded(
                            Deadline.create(),
                            stageTransactions.map((t) => t.toAggregate(multisigAccount)),
                            this.networkType,
                            [],
                            maxFee,
                        ),
                    );
                    const signedAggregateTransaction = await symbolLedger
                        .signTransaction(currentPath, aggregate, this.generationHash, ledgerAccount.publicKey)
                        .then((signedAggregateTransaction) => {
                            return signedAggregateTransaction;
                        });
                    const hashLock = this.command.calculateSuggestedMaxFeeLedger(
                        LockFundsTransaction.create(
                            Deadline.create(),
                            new Mosaic(this.networkMosaic, UInt64.fromNumericString(this.networkConfiguration.lockedFundsPerAggregate)),
                            UInt64.fromUint(1000),
                            signedAggregateTransaction,
                            this.networkType,
                            maxFee,
                        ),
                    );
                    const signedHashLock = await symbolLedger
                        .signTransaction(currentPath, hashLock, this.generationHash, ledgerAccount.publicKey)
                        .then((res) => {
                            return res;
                        });
                    const signedTransactions: Observable<SignedTransaction>[] = [of(signedHashLock), of(signedAggregateTransaction)];
                    // - notify about successful transaction announce
                    this.$store.dispatch('notification/ADD_SUCCESS', 'success_transactions_signed');
                    this.$emit('success');
                    this.onConfirmationSuccess();
                    const service = new TransactionAnnouncerService(this.$store);
                    const announcements = await of(this.command.announceHashAndAggregateBondedLedger(service, signedTransactions));
                    announcements.forEach((announcement) => {
                        announcement.subscribe((res) => {
                            if (!res.success) {
                                this.$store.dispatch('notification/ADD_ERROR', res.error, { root: true });
                            }
                        });
                    });
                    this.show = false;
                }
            } catch (error) {
                // }
                this.$Notice.error({
                    title: this['$t']('Please check your device connection!') + '',
                });
                this.show = false;
            }
        }
    }

    /**
     * Hook called when child component FormProfileUnlock or
     * HardwareConfirmationButton emit the 'error' event.
     * @param {string} message
     * @return {void}
     */
    public onError(error: string) {
        this.$emit('error', error);
    }
    public onConfirmationSuccess() {
        this.$store.dispatch('notification/ADD_SUCCESS', 'success_transactions_signed');
        this.$emit('success');
    }
    /**
     * Reset form validation
     * @private
     */
    private resetFormValidation(): void {
        this.$refs && this.$refs.observer && this.$refs.observer.reset();
    }
}
