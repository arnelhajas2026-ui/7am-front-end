import { createApp } from 'vue';
import { createPinia } from 'pinia';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/theme.css';           // First Light theme — after Bootstrap para mag-override
import App from './App.vue';
import router from './router/index.js';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
