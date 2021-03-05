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
import { Component, Vue } from 'vue-property-decorator';
import { mapGetters } from 'vuex';
import { AccountInfo, Address, MosaicId, NetworkType, Password, RepositoryFactory } from 'symbol-sdk';
import { Network } from 'symbol-hd-wallets';
// internal dependencies
import { AccountModel, AccountType } from '@/core/database/entities/AccountModel';
import { DerivationPathLevels, DerivationService } from '@/services/DerivationService';
import { AccountService } from '@/services/AccountService';
import { NotificationType } from '@/core/utils/NotificationType';
import { Formatters } from '@/core/utils/Formatters';
// child components
// @ts-ignore
import MosaicAmountDisplay from '@/components/MosaicAmountDisplay/MosaicAmountDisplay.vue';
import { NetworkCurrencyModel } from '@/core/database/entities/NetworkCurrencyModel';
import { ProfileModel } from '@/core/database/entities/ProfileModel';
import { ProfileService } from '@/services/ProfileService';
import { SimpleObjectStorage } from '@/core/database/backends/SimpleObjectStorage';

@Component({
    computed: {
        ...mapGetters({
            networkType: 'network/networkType',
            networkMosaic: 'mosaic/networkMosaic',
            networkCurrency: 'mosaic/networkCurrency',
            currentProfile: 'profile/currentProfile',
            currentPassword: 'temporary/password',
            currentMnemonic: 'temporary/mnemonic',
            selectedAccounts: 'account/selectedAddressesToInteract',
            selectedOptInAccounts: 'account/selectedAddressesOptInToInteract',
        }),
    },
    components: { MosaicAmountDisplay },
})
export default class AccountSelectionTs extends Vue {
    /**
     * Formatting helpers
     * @protected
     */
    protected formatters = Formatters;

    /**
     * Network's currency mosaic id
     * @see {Store.networkType}
     * @var {NetworkType}
     */
    public networkType: NetworkType;

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
     * Temporary stored password
     * @see {Store.Temporary}
     * @var {Password}
     */
    public currentPassword: Password;

    /**
     * Derivation Service
     * @var {DerivationService}
     */
    public derivation: DerivationService;

    /**
     * Account Service
     * @var {AccountService}
     */
    public accountService: AccountService;

    /**
     * Profile service
     * @var {ProfileService}
     */
    public profileService: ProfileService = new ProfileService();

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
     * Map of selected opt in accounts
     * @var {number[]}
     */
    public selectedOptInAccounts: number[];

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

    public networkCurrency: NetworkCurrencyModel;

    /**
     * Hook called when the page is mounted
     * @return {void}
     */
    async mounted() {
        this.derivation = new DerivationService(this.currentProfile.networkType);
        this.accountService = new AccountService();

        Vue.nextTick().then(() => {
            setTimeout(() => {
                this.initAccounts();
                // this.initOptInAccounts();
            }, 200);
        });
    }

    public previous() {
        this.addressesList.length = 0;
        this.$router.push({ name: 'profiles.accessLedger.info' });
    }

    /**
     * Finalize the account selection process by adding
     * the selected accounts to storage.
     * @return {void}
     */
    public async submit() {
        // cannot submit without selecting at least one account
        if (!this.selectedAccounts.length) {
            return this.$store.dispatch('notification/ADD_ERROR', NotificationType.IMPORT_EMPTY_ACCOUNT_LIST);
        }

        try {
            // create account models
            const normalAccounts = await this.createAccountsFromPathIndexes(this.selectedAccounts);
            // const optInAccounts = await this.createOptInAccountsFromPathIndexes(this.selectedOptInAccounts);

            const accounts = [...normalAccounts];
            // save newly created accounts
            accounts.forEach((account, index) => {
                // Store accounts using repository
                this.accountService.saveAccount(account);
                // set current account
                if (index === 0) {
                    this.$store.dispatch('account/SET_CURRENT_ACCOUNT', account);
                }
                // add accounts to profile
                this.$store.dispatch('profile/ADD_ACCOUNT', account);
            });

            // get accounts identifiers
            const accountIdentifiers = accounts.map((account) => account.id);

            // set known accounts
            this.$store.dispatch('account/SET_KNOWN_ACCOUNTS', accountIdentifiers);

            this.profileService.updateAccounts(this.currentProfile, accountIdentifiers);

            this.$store.dispatch('temporary/RESET_STATE');
            // execute store actions
            return this.$router.push({ name: 'profiles.accessLedger.finalize' });
        } catch (error) {
            return this.$store.dispatch('notification/ADD_ERROR', error);
        }
    }

    /**
     * Fetch account balances and map to address
     * @return {void}
     */
    private async initAccounts() {
        // - generate addresses
        this.addressesList = await this.accountService.getLedgerAddresses(this.currentProfile.networkType, 3);
        const repositoryFactory = this.$store.getters['network/repositoryFactory'] as RepositoryFactory;
        // fetch accounts info
        const accountsInfo = await repositoryFactory.createAccountRepository().getAccountsInfo(this.addressesList).toPromise();
        if (!accountsInfo) {
            return;
        }
        // map balances
        this.addressMosaicMap = {
            ...this.addressMosaicMap,
            ...this.mapBalanceByAddress(accountsInfo, this.networkMosaic),
        };
    }

    /**
     * Fetch account balances and map to address
     * @return {void}
     */
    // private async initOptInAccounts() {
    //     // - generate addresses
    //     const possibleOptInAccounts = this.accountService.generateAccountsFromMnemonic(
    //         new MnemonicPassPhrase(this.currentMnemonic),
    //         this.currentProfile.networkType,
    //         10,
    //         Network.BITCOIN,
    //     );

    //     // whitelist opt in accounts
    //     const key = this.currentProfile.networkType === NetworkType.MAIN_NET ? 'MAINNET' : 'TESTNET';
    //     const whitelisted = process.env[`VUE_APP_${key}_WHITELIST`] ? process.env[`VUE_APP_${key}_WHITELIST`].split(',') : [];
    //     const optInAccounts = possibleOptInAccounts.filter((account) => whitelisted.indexOf(account.publicKey) >= 0);
    //     if (optInAccounts.length === 0) {
    //         return;
    //     }
    //     this.optInAddressesList = optInAccounts.map((account) => account.address);

    //     // fetch accounts info
    //     const repositoryFactory = this.$store.getters['network/repositoryFactory'] as RepositoryFactory;
    //     const accountsInfo = await repositoryFactory.createAccountRepository().getAccountsInfo(this.addressesList).toPromise();

    //     // map balances
    //     this.addressMosaicMap = {
    //         ...this.addressMosaicMap,
    //         ...this.mapBalanceByAddress(accountsInfo, this.networkMosaic),
    //     };
    // }

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

    /**
     * Create an account instance from mnemonic and path
     * @return {AccountModel}
     */
    private async createAccountsFromPathIndexes(indexes: number[]): Promise<AccountModel[]> {
        const accountPath = AccountService.getAccountPathByNetworkType(this.currentProfile.networkType);
        const paths = indexes.map((index) => {
            if (index == 0) {
                return accountPath;
            }

            return this.derivation.incrementPathLevel(accountPath, DerivationPathLevels.Profile, index);
        });

        const accounts = await this.accountService.generateLedgerAccountsPaths(this.currentProfile.networkType, paths);

        return accounts.map((account, i) => {
            return {
                id: SimpleObjectStorage.generateIdentifier(),
                profileName: this.currentProfile.profileName,
                name: `Ledger Account ${indexes[i] + 1}`,
                node: '',
                type: AccountType.LEDGER,
                address: account.address,
                publicKey: accounts[i].publicKey,
                encryptedPrivateKey: '',
                path: paths[i],
                isMultisig: false,
            };
        });
    }

    /**
     * Create an optin account instance from mnemonic and path
     * @return {AccountModel}
     */
    private async createOptInAccountsFromPathIndexes(indexes: number[]): Promise<AccountModel[]> {
        const accountPath = AccountService.getAccountPathByNetworkType(this.currentProfile.networkType);
        const paths = indexes.map((index) => {
            if (index == 0) {
                return accountPath;
            }

            return this.derivation.incrementPathLevel(accountPath, DerivationPathLevels.Profile, index);
        });

        const accounts = await this.accountService.generateLedgerAccountsPaths(this.currentProfile.networkType, paths, Network.BITCOIN);

        return accounts.map((account, i) => {
            return {
                id: SimpleObjectStorage.generateIdentifier(),
                profileName: this.currentProfile.profileName,
                name: `Opt In Ledger Account ${indexes[i] + 1}`,
                node: '',
                type: AccountType.LEDGER_OPT_IN,
                address: account.address,
                publicKey: accounts[i].publicKey,
                encryptedPrivateKey: '',
                path: paths[i],
                isMultisig: false,
            };
        });
    }

    /**
     * Called when clicking on an address to add it to the selection
     * @param {number} pathNumber
     */
    protected onAddAddress(pathNumber: number): void {
        this.$store.commit('account/addToSelectedAddressesToInteract', pathNumber);
    }
    /**
     * Called when clicking on an address to add it to the selection optin
     * @param {number} pathNumber
     */
    protected onAddAddressOptIn(pathNumber: number): void {
        this.$store.commit('account/addToSelectedAddressesOptInToInteract', pathNumber);
    }
}
