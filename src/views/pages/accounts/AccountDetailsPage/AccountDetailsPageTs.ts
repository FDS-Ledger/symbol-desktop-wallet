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
// external dependencies
import { Component, Vue } from 'vue-property-decorator';
import { mapGetters } from 'vuex';
import { LedgerService } from '@/services/LedgerService';
import { ProfileModel } from '@/core/database/entities/ProfileModel';
// child components
// @ts-ignore
import AccountNameDisplay from '@/components/AccountNameDisplay/AccountNameDisplay.vue';
// @ts-ignore
import ProtectedPrivateKeyDisplay from '@/components/ProtectedPrivateKeyDisplay/ProtectedPrivateKeyDisplay.vue';
// @ts-ignore
import ImportanceScoreDisplay from '@/components/ImportanceScoreDisplay/ImportanceScoreDisplay.vue';
// @ts-ignore
import AccountContactQR from '@/components/AccountContactQR/AccountContactQR.vue';
// @ts-ignore
import AccountAddressDisplay from '@/components/AccountAddressDisplay/AccountAddressDisplay.vue';
// @ts-ignore
import AccountPublicKeyDisplay from '@/components/AccountPublicKeyDisplay/AccountPublicKeyDisplay.vue';
// @ts-ignore
import AccountActions from '@/components/AccountActions/AccountActions.vue';
// @ts-ignore
import AccountLinks from '@/components/AccountLinks/AccountLinks.vue';
// @ts-ignore
import AccountAliasDisplay from '@/components/AccountAliasDisplay/AccountAliasDisplay.vue';
// @ts-ignore
import AccountMetadataDisplay from '@/components/AccountMetadataDisplay/AccountMetadataDisplay.vue';
// @ts-ignore
import AccountMultisigGraph from '@/components/AccountMultisigGraph/AccountMultisigGraph.vue';

import { AccountModel, AccountType } from '@/core/database/entities/AccountModel';

import { AccountService } from '@/services/AccountService';
// @ts-ignore
import ModalFormProfileUnlock from '@/views/modals/ModalFormProfileUnlock/ModalFormProfileUnlock.vue';
// @ts-ignore
import ModalMetadataDisplay from '@/views/modals/ModalMetadataDisplay/ModalMetadataDisplay.vue';
import { MetadataModel } from '@/core/database/entities/MetadataModel';
// @ts-ignore
import ModalMetadataUpdate from '@/views/modals/ModalMetadataUpdate/ModalMetadataUpdate.vue';
// @ts-ignore
import ModalConfirm from '@/views/modals/ModalConfirm/ModalConfirm.vue';
@Component({
    components: {
        AccountNameDisplay,
        ProtectedPrivateKeyDisplay,
        ImportanceScoreDisplay,
        AccountContactQR,
        AccountActions,
        AccountLinks,
        AccountAddressDisplay,
        AccountPublicKeyDisplay,
        AccountAliasDisplay,
        AccountMetadataDisplay,
        AccountMultisigGraph,
        ModalFormProfileUnlock,
        ModalMetadataDisplay,
        ModalMetadataUpdate,
        ModalConfirm,
    },
    computed: {
        ...mapGetters({
            defaultAccount: 'app/defaultAccount',
            currentAccount: 'account/currentAccount',
            knownAccounts: 'account/knownAccounts',
            accountMetadataList: 'metadata/accountMetadataList',
        }),
    },
})
export class AccountDetailsPageTs extends Vue {
    /**
     * Default account
     * @see {Store.Account}
     * @var {string}
     */
    public defaultAccount: string;

    public currentProfile: ProfileModel;

    public metadataEntry: MetadataModel;
    /**
     * known accounts on current network
     * @type {AccountModel[]}
     */
    public knownAccounts: AccountModel[];

    /**
     * account metadata list
     * @type {MetadataModel[]}
     */
    public accountMetadataList: MetadataModel[];

    /**
     * Whether account is currently being unlocked
     * @var {boolean}
     */
    public isUnlockingAccount: boolean = false;

    /**
     * metadata detail modal visibility
     */
    public showMetadataDetailModal: boolean = false;

    /**
     * metadata detail modal visibility
     */
    public showUpdateMetadataModal: boolean = false;

    public showConfirmationModal = false;

    /**
     * Currently active account
     * @see {Store.Account}
     * @var {AccountModel}
     */
    public currentAccount: AccountModel;
    public readonly accountService: AccountService = new AccountService();

    public deleteAccountConfirmation() {
        this.showConfirmationModal = true;
    }

    public async showAddressLedger() {
        try {
            const ledgerService = new LedgerService();
            const isAppSupported = await ledgerService.isAppSupported();
            if (!isAppSupported) {
                throw { errorCode: 'ledger_not_supported_app' };
            }
            const currentPath = this.currentAccount.path;
            const networkType = this.currentProfile.networkType;
            const accountService = new AccountService();
            this.$store.dispatch('notification/ADD_SUCCESS', 'verify_device_information');
            const signerPublicKey = await accountService.getLedgerPublicKeyByPath(networkType, currentPath);
        } catch (error) {
            this.$store.dispatch('SET_UI_DISABLED', {
                isDisabled: false,
                message: '',
            });
            throw error;
        }
    }

    public async deleteAccount() {
        this.showConfirmationModal = false;
        if (this.currentAccount) {
            this.hasAccountUnlockModal = true;
            return;
        }
    }

    public get hasAccountUnlockModal(): boolean {
        return this.isUnlockingAccount;
    }

    public set hasAccountUnlockModal(f: boolean) {
        this.isUnlockingAccount = f;
    }

    public get isLedger(): boolean {
        return this.currentAccount.type == AccountType.LEDGER;
    }

    /**
     * When account is unlocked, the sub account can be created
     */
    public async onAccountUnlocked() {
        try {
            await this.$store.dispatch('account/DELETE_CURRENT_ACCOUNT', this.currentAccount);
        } catch (e) {
            this.$store.dispatch('notification/ADD_ERROR', 'An error happened, please try again.');
            console.error(e);
        }
    }
    openEditModal(value) {
        this.showUpdateMetadataModal = true;
        this.metadataEntry = value;
    }
}
