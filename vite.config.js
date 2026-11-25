import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins:[react()], root:'.',build:{outDir:'client/dist',emptyOutDir:true}, server:{port:5173,proxy:{'/api':'http://localhost:10000','/healthz':'http://localhost:10000'}} });
