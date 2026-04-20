import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { presetUno, presetIcons, presetAttributify } from 'unocss'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/postsqlgame/' : '/',
  plugins: [
    vue(),
    UnoCSS({
      presets: [
        presetUno(),
        presetIcons(),
        presetAttributify(),
      ],
    }),
  ],
}))
