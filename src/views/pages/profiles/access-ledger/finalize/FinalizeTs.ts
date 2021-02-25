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
import { ProfileModel } from '@/core/database/entities/ProfileModel';
import { ProfileService } from '@/services/ProfileService';
import { SimpleObjectStorage } from '@/core/database/backends/SimpleObjectStorage';
import { AccountModel, AccountType } from '@/core/database/entities/AccountModel';
import { PublicAccount } from 'symbol-sdk';
import { AccountService } from '@/services/AccountService';

import { LedgerService } from '@/services/LedgerService';
import { Component, Vue } from 'vue-property-decorator';
import { mapGetters } from 'vuex';

@Component({
    computed: {
        ...mapGetters({
            currentProfile: 'profile/currentProfile',
        }),
    },
})
export default class FinalizeTs extends Vue {
    /**
     * Finalize the profile creation process by adding
     * just redirect to dasbroad page.
     * @return {void}
     */
    /**
     * Profile Service
     * @var {ProfileService}
     */
    public profileService: ProfileService = new ProfileService();
    /**
     * Ledger Accounts repository
     * @var {AccountService}
     */
    public ledgerAccountService = new AccountService();
    public marked: boolean = false;
    public currentProfile: ProfileModel;
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
    
    /**
     * Get a account instance of Ledger from default path
     * @return {AccountModel}
     */
    private async importDefaultLedgerAccount(networkType: number): Promise<AccountModel> {
        const defaultPath = AccountService.getAccountPathByNetworkType(networkType);
        const ledgerService = new LedgerService(networkType);
        const isAppSupported = await ledgerService.isAppSupported();
        if (!isAppSupported) {
            throw { errorCode: 'ledger_not_supported_app' };
        }
        const accountService = new AccountService();
        // this.$store.dispatch('notification/ADD_SUCCESS', 'verify_device_information');
        const publicKey = await accountService.getLedgerPublicKeyByPath(networkType, defaultPath, false);
        const address = PublicAccount.createFromPublicKey(publicKey, networkType).address;

        // add account to list
        const { profileName } = this.currentProfile;

        return {
            id: SimpleObjectStorage.generateIdentifier(),
            name: profileName,
            profileName: profileName,
            node: '',
            type: AccountType.fromDescriptor('Ledger'),
            address: address.plain(),
            publicKey: publicKey.toUpperCase(),
            encryptedPrivateKey: '',
            path: defaultPath,
            isMultisig: false,
        };
    }

    public async submit() {
        this.importDefaultLedgerAccount(this.currentProfile.networkType)
        .then((res) => {
            this.ledgerAccountService.saveAccount(res);
            this.profileService.updateProfileTermsAndConditionsStatus(this.currentProfile, true);
            
            // execute store actions
            this.$store.dispatch('profile/ADD_ACCOUNT', res);
            this.$store.dispatch('account/SET_CURRENT_ACCOUNT', res);
            this.$store.dispatch('account/SET_KNOWN_ACCOUNTS', [res.id]);
            this.$store.dispatch('temporary/RESET_STATE');

            // flush and continue
            return this.$router.push({ name: 'dashboard' });
        })
        .catch((error) => {
            this.errorNotificationHandler(error);
        });
    }
}
