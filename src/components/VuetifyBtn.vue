<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  text: {
    type: String,
    required: true,
  }
});

const text = ref(props.text);
const count = ref(0);

const onClick = () => {
  text.value = props.text + " " + ++count.value;
};
</script>

<template>
  <v-btn @click="onClick">{{ text }}</v-btn>
</template>
