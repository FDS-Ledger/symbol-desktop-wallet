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
import { NetworkType, Password } from 'symbol-sdk';
// internal dependencies
import { ValidationRuleset } from '@/core/validation/ValidationRuleset';
import { ProfileService } from '@/services/ProfileService';
import { ProfileModel } from '@/core/database/entities/ProfileModel';
// child components
import { ValidationObserver, ValidationProvider } from 'vee-validate';
// @ts-ignore
import ErrorTooltip from '@/components/ErrorTooltip/ErrorTooltip.vue';
// @ts-ignore
import FormWrapper from '@/components/FormWrapper/FormWrapper.vue';
// @ts-ignore
import FormRow from '@/components/FormRow/FormRow.vue';
import { NetworkTypeHelper } from '@/core/utils/NetworkTypeHelper';
import { FilterHelpers } from '@/core/utils/FilterHelpers';
import { AccountService } from '@/services/AccountService';
import { networkConfig } from '@/config';
/// end-region custom types

@Component({
    components: {
        ValidationObserver,
        ValidationProvider,
        ErrorTooltip,
        FormWrapper,
        FormRow,
    },
    computed: {
        ...mapGetters({
            generationHash: 'network/generationHash',
            currentProfile: 'profile/currentProfile',
        }),
    },
})
export class FormProfileCreationTs extends Vue {
    /**
     * Currently active profile
     * @see {Store.Profile}
     * @var {string}
     */
    public currentProfile: ProfileModel;

    /**
     * Currently active profile
     * @see {Store.Profile}
     * @var {string}
     */
    public profileService: ProfileService;

    isLedger = false;

    created() {
        this.profileService = new ProfileService();
        this.formItems.networkType = NetworkType.TEST_NET;
        const { isLedger } = this.$route.meta;
        this.isLedger = isLedger;
    }

    /**
     * Currently active network type
     * @see {Store.Network}
     * @var {string}
     */
    public generationHash: string;

    /**
     * Accounts repository
     * @var {ProfileService}
     */
    public accountService = new ProfileService();

    /**
     * Ledger Accounts repository
     * @var {ProfileService}
     */
    public ledgerAccountService = new AccountService();

    /**
     * Validation rules
     * @var {ValidationRuleset}
     */
    public validationRules = ValidationRuleset;

    /**
     * Form fields
     * @var {Object}
     */
    public formItems = {
        profileName: '',
        password: '',
        passwordAgain: '',
        hint: '',
        networkType: this.$store.getters['network/networkType'],
    };

    /**
     * Network types
     * @var {NetworkNodeEntry[]}
     */
    public networkTypeList = NetworkTypeHelper.networkTypeList;

    /**
     * Type the ValidationObserver refs
     * @type {{
     *     observer: InstanceType<typeof ValidationObserver>
     *   }}
     */
    public $refs!: {
        observer: InstanceType<typeof ValidationObserver>;
    };

    /// region computed properties getter/setter
    get nextPage() {
        return this.$route.meta.nextPage;
    }

    /// end-region computed properties getter/setter

    public onNetworkTypeChange(newNetworkType) {
        this.$store.dispatch('network/CONNECT', { networkType: newNetworkType });
    }

    /**
     * Submit action, validates form and creates account in storage
     * @return {void}
     */
    public submit() {
        // @VEE
        this.persistAccountAndContinue();
        this.resetValidations();
    }

    /**
     *  resets form validation
     */

    public resetValidations(): void {
        this.$refs && this.$refs.observer && this.$refs.observer.reset();
    }

    /**
     * Persist created account and redirect to next step
     * @return {void}
     */
    private persistAccountAndContinue() {
        // -  password stored as hash (never plain.)
        const passwordHash = ProfileService.getPasswordHash(new Password(this.formItems.password));
        const genHash = this.generationHash || networkConfig[this.formItems.networkType].networkConfigurationDefaults.generationHash;
        const account: ProfileModel = {
            profileName: this.formItems.profileName,
            accounts: [],
            seed: '',
            password: passwordHash,
            hint: this.formItems.hint,
            networkType: this.formItems.networkType,
            generationHash: genHash,
            termsAndConditionsApproved: false,
            selectedNodeUrlToConnect: '',
        };
        // use repository for storage
        this.accountService.saveProfile(account);

        // execute store actions
        this.$store.dispatch('profile/SET_CURRENT_PROFILE', account);
        this.$store.dispatch('temporary/SET_PASSWORD', this.formItems.password);
        if (!this.isLedger) {
            // flush and continue
            this.$router.push({ name: this.nextPage });
        } else {
            this.$router.push({ name: 'profiles.accessLedger.finalize' });
        }
    }

    /**
     * filter tags
     */
    public stripTagsProfile() {
        this.formItems.profileName = FilterHelpers.stripFilter(this.formItems.profileName);
        this.formItems.hint = FilterHelpers.stripFilter(this.formItems.hint);
    }
}
