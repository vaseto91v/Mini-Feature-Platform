<template>
  <div class="min-h-screen bg-neutral-100 dark:bg-surface-dark">
    <AppTopBar />
    <div class="flex">
      <AppSideNav />
      <main class="min-h-[calc(100vh-52px)] flex-1">
        <slot />
      </main>
    </div>
  </div>
</template>
