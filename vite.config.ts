import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {iCloudBackupPlugin} from './server/icloud';
export default defineConfig({plugins:[react(),iCloudBackupPlugin()],base:'./'});
