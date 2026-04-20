import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/level/:chapterId/:levelId',
      name: 'level',
      component: () => import('../views/LevelView.vue'),
    },
  ],
})

export default router
