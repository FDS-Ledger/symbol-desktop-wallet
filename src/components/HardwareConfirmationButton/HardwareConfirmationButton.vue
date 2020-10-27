<template>
    <Button type="success" @click="processHardware">
        {{ $t('confirm_transaction_prompt') }}
    </Button>
</template>

<script lang="ts">
import { HardwareConfirmationButtonTs } from './HardwareConfirmationButtonTs';

export default class HardwareConfirmationButton extends HardwareConfirmationButtonTs {}
</script>
