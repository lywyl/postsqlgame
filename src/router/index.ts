import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
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
