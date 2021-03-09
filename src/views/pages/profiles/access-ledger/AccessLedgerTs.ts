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
import { Component, Vue, Watch } from 'vue-property-decorator';
import { Formatters } from '@/core/utils/Formatters';
import { mapGetters } from 'vuex';
import { MnemonicPassPhrase, Network } from 'symbol-hd-wallets';
import { AccountInfo, Address, MosaicId, NetworkType, RepositoryFactory } from 'symbol-sdk';
import { ProfileModel } from '@/core/database/entities/ProfileModel';
import { AccountService } from '@/services/AccountService';
// @ts-ignore
import MosaicAmountDisplay from '@/components/MosaicAmountDisplay/MosaicAmountDisplay.vue';

@Component({
    components: {
        MosaicAmountDisplay,
    },
    computed: {
        ...mapGetters({
            currentMnemonic: 'temporary/mnemonic',
            networkType: 'network/networkType',
            networkMosaic: 'mosaic/networkMosaic',
            networkCurrency: 'mosaic/networkCurrency',
            currentProfile: 'profile/currentProfile',
            currentPassword: 'temporary/password',
            selectedAccounts: 'account/selectedAddressesToInteract',
            optInSelectedAccounts: 'account/selectedAddressesOptInToInteract',
        }),
    },
})
export default class AccessLedgerTs extends Vue {
    /**
     * Formatting helpers
     * @protected
     */
    protected formatters = Formatters;
    /**
     * List of steps
     * @var {string[]}
     */
    public StepBarTitleList = ['create_profile', 'select_accounts', 'finish'];

    /**
     * Network's currency mosaic id
     * @see {Store.Mosaic}
     * @var {MosaicId}
     */
    public networkMosaic: MosaicId;

    /**
     * Currently active profile
     * @see {Store.Profile}
     * @var {string}
     */
    public currentProfile: ProfileModel;

    /**
     * Temporary stored mnemonic pass phrase
     * @see {Store.Temporary}
     * @var {MnemonicPassPhrase}
     */
    public currentMnemonic: string;

    /**
     * Account Service
     * @var {AccountService}
     */
    public accountService: AccountService;

    /**
     * List of addresses
     * @var {Address[]}
     */
    public addressesList: Address[] = [];

    /**
     * List of opt in addresses
     * @var {Address[]}
     */
    public optInAddressesList: Address[] = [];

    /**
     * Balances map
     * @var {any}
     */
    public addressMosaicMap = {};

    /**
     * Map of selected accounts
     * @var {number[]}
     */
    public selectedAccounts: number[];

    /**
     * Map of selected accounts
     * @var {number[]}
     */
    public optInSelectedAccounts: number[];

    /**
     * Indicates if account balance and addresses are already fetched
     */
    private initialized: boolean = false;
    private optInInitialized: boolean = false;

    /**
     * Hook called when the page is mounted
     * @return {void}
     */
    async mounted() {
        this.accountService = new AccountService();
        Vue.nextTick().then(() => {
            setTimeout(() => this.initAccounts(), 300);
        });
        Vue.nextTick().then(() => {
            setTimeout(() => this.initOptInAccounts(), 300);
        });
        await this.$store.dispatch('temporary/initialize');
    }

    /**
     * Error notification handler
     */
    private errorNotificationHandler(error: any) {
        if (error.message && error.message.includes('cannot open device with path')) {
            error.errorCode = 'ledger_connected_other_app';
        }
        if (error.errorCode) {
            switch (error.errorCode) {
                case 'NoDevice':
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_no_device');
                    return;
                case 'ledger_not_supported_app':
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_not_supported_app');
                    return;
                case 'ledger_connected_other_app':
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_connected_other_app');
                    return;
                case 26628:
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_device_locked');
                    return;
                case 26368:
                case 27904:
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_not_opened_app');
                    return;
                case 27264:
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_not_using_xym_app');
                    return;
                case 27013:
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_user_reject_request');
                    return;
            }
        } else if (error.name) {
            switch (error.name) {
                case 'TransportOpenUserCancelled':
                    this.$store.dispatch('notification/ADD_ERROR', 'ledger_no_device_selected');
                    return;
            }
        }
        this.$store.dispatch('notification/ADD_ERROR', this.$t('create_profile_failed', { reason: error.message || error }));
    }

    @Watch('selectedAccounts')
    /**
     * Fetch account balances and map to address
     * @return {void}
     */
    private async initAccounts() {
        try {
            if (this.initialized) {
                return;
            }
            if (this.addressesList.length === 0) {
                // - generate addresses
                this.addressesList = await this.accountService.getLedgerAddresses(this.currentProfile.networkType, 3);
            }
            const repositoryFactory = this.$store.getters['network/repositoryFactory'] as RepositoryFactory;
            // fetch accounts info
            const accountsInfo = await repositoryFactory.createAccountRepository().getAccountsInfo(this.addressesList).toPromise();
            if (!accountsInfo) {
                return;
            }
            // map balances
            this.addressMosaicMap = this.mapBalanceByAddress(accountsInfo, this.networkMosaic);

            this.initialized = true;
        } catch (error) {
            this.errorNotificationHandler(error);
        }
    }

    /**
     * Fetch account balances and map to address
     * @return {void}
     */
    @Watch('optInSelectedAccounts')
    private async initOptInAccounts() {
        if (this.optInInitialized) {
            return;
        }

        // - generate addresses
        const possibleOptInAccounts = this.accountService.generateAccountsFromMnemonic(
            new MnemonicPassPhrase(this.currentMnemonic),
            this.currentProfile.networkType,
            10,
            Network.BITCOIN,
        );

        // whitelist opt in accounts
        const key = this.currentProfile.networkType === NetworkType.MAIN_NET ? 'MAINNET' : 'TESTNET';
        const whitelisted = process.env[`VUE_APP_${key}_WHITELIST`] ? process.env[`VUE_APP_${key}_WHITELIST`].split(',') : [];
        const optInAccounts = possibleOptInAccounts.filter((account) => whitelisted.indexOf(account.publicKey) >= 0);
        if (optInAccounts.length === 0) {
            return;
        }
        this.optInAddressesList = optInAccounts.map((account) => account.address);

        // fetch accounts info
        const repositoryFactory = this.$store.getters['network/repositoryFactory'] as RepositoryFactory;
        const accountsInfo = await repositoryFactory.createAccountRepository().getAccountsInfo(this.addressesList).toPromise();

        // map balances
        this.addressMosaicMap = {
            ...this.addressMosaicMap,
            ...this.mapBalanceByAddress(accountsInfo, this.networkMosaic),
        };

        this.optInInitialized = true;
    }

    public mapBalanceByAddress(accountsInfo: AccountInfo[], mosaic: MosaicId): Record<string, number> {
        return accountsInfo
            .map(({ mosaics, address }) => {
                // - check balance
                const hasNetworkMosaic = mosaics.find((mosaicOwned) => mosaicOwned.id.equals(mosaic));

                // - account doesn't hold network mosaic so the balance is zero
                if (hasNetworkMosaic === undefined) {
                    return {
                        address: address.plain(),
                        balance: 0,
                    };
                }
                // - map balance to address
                const balance = hasNetworkMosaic.amount.compact();
                return {
                    address: address.plain(),
                    balance: balance,
                };
            })
            .reduce((acc, { address, balance }) => ({ ...acc, [address]: balance }), {});
    }

    public getCurrentStep(): number {
        switch (this.$route.name) {
            default:
            case 'profiles.accessLedger.info':
                return 0;
            case 'profiles.accessLedger.walletSelection':
                return 1;
            case 'profiles.accessLedger.finalize':
                return 2;
        }
    }

    public getStepClassName(index: number): string {
        return this.getCurrentStep() == index ? 'active' : this.getCurrentStep() > index ? 'done' : '';
    }

    /**
     * Called when clicking on an address to remove it from the selection
     * @protected
     * @param {number} pathNumber
     */
    protected onRemoveAddress(pathNumber: number): void {
        this.$store.commit('account/removeFromSelectedAddressesToInteract', pathNumber);
    }
    /**
     * Called when clicking on an address to remove it from the selection
     * @protected
     * @param {number} pathNumber
     */
    protected onRemoveOptInAddress(pathNumber: number): void {
        this.$store.commit('account/removeFromSelectedAddressesOptInToInteract', pathNumber);
    }
}
