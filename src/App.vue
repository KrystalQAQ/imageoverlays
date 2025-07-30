<template>
  <div id="app-container">
    <header class="app-header">
      <h1>Image Annotation Tool</h1>
    </header>
    <main class="app-main">
      <div class="tool-wrapper">
        <AnnotationTool ref="annotationToolRef" @history-changed="updateHistory" />
      </div>
      <aside class="sidebar">
        <div class="image-panel">
          <h2>Image List</h2>
          <ul class="image-list">
            <li v-for="(img, index) in imageList" :key="img.id" :class="{ active: index === currentImageIndex }"
              @click="switchImage(index)">
              {{ img.name }}
            </li>
          </ul>
        </div>
        <div class="history-panel">
          <h2>History</h2>
          <ul class="history-list">
            <li v-for="item in history" :key="item.id" :class="{ active: item.active }" @click="goToHistory(item.id)">
              {{ item.name || `State ${item.id}` }}
            </li>
          </ul>
        </div>
      </aside>
    </main>
  </div>
</template>

<script setup>
import AnnotationTool from './components/AnnotationTool.vue';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const imageList = ref([
  // { id: 'img-1', name: 'Image 1', src: '/src/assets/1.jpg' },
  // { id: 'img-2', name: 'Image 2', src: '/src/assets/2.jpg' },
  { id: 'img-3', name: 'Image 3', src: '/src/assets/3.jpg' },
  { id: 'img-4', name: 'Image 4', src: '/src/assets/4.jpg' },
  { id: 'img-5', name: 'Image 5', src: '/src/assets/5.jpg' },

]);
const currentImageIndex = ref(-1);
const annotationsStore = ref({});

imageList.value.forEach(img => {
  annotationsStore.value[img.id] = {
      annotations: [],
      history: null, // Will store { history: [], historyIndex: 0 }
  };
});

const history = ref([]);
const annotationToolRef = ref(null);

const updateHistory = (newHistory) => {
  history.value = newHistory;
};

const goToHistory = (index) => {
  annotationToolRef.value?.loadStateFromHistory(index);
};

const switchImage = (newIndex) => {
  if (newIndex < 0 || newIndex >= imageList.value.length || newIndex === currentImageIndex.value) {
    return;
  }

  const tool = annotationToolRef.value;
  if (!tool) return;

  if (currentImageIndex.value !== -1) {
    const currentImageId = imageList.value[currentImageIndex.value].id;
    annotationsStore.value[currentImageId] = {
        annotations: tool.getAnnotations(),
        history: tool.historyManager.getHistoryState(),
    };
    console.log(`Saved state for ${currentImageId}:`, annotationsStore.value[currentImageId]);
  }

  currentImageIndex.value = newIndex;
  const newImage = imageList.value[newIndex];

  const newState = annotationsStore.value[newImage.id] || { annotations: [], history: null };
  console.log(`Loading state for ${newImage.id}:`, newState);
  tool.loadImageAndAnnotationsWithHistory(newImage.src, newState.history || { history: [], historyIndex: 0 });
};

const handleKeydown = (e) => {
  const targetTagName = e.target.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(targetTagName)) {
    return;
  }

  if (e.key.toLowerCase() === 'd') {
    switchImage(currentImageIndex.value + 1);
  } else if (e.key.toLowerCase() === 'a') {
    switchImage(currentImageIndex.value - 1);
  }
};

onMounted(() => {
  if (annotationToolRef.value) {
    switchImage(0);
  }
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style>
:root {
  --header-height: 60px;
  --sidebar-width: 240px;
  --primary-bg: #f7f9fa;
  --secondary-bg: #ffffff;
  --border-color: #e8e8e8;
  --text-primary: #333;
  --text-secondary: #777;
  --accent-color: #4a69ff;
}

body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: var(--primary-bg);
}

#app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  height: var(--header-height);
  background-color: var(--secondary-bg);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  padding: 0 2rem;
  flex-shrink: 0;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.app-main {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

.tool-wrapper {
  flex-grow: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar {
  width: var(--sidebar-width);
  background-color: var(--secondary-bg);
  border-left: 1px solid var(--border-color);
  padding: 1.5rem;
  overflow-y: auto;
  transition: width 0.3s ease;
}

.image-panel {
  margin-bottom: 2rem;
}

.image-panel h2 {
  margin-top: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.image-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.image-list li {
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  color: var(--text-secondary);
  border: 1px solid transparent;
}

.image-list li:hover {
  background-color: #f0f2f5;
  border-color: #e0e0e0;
}

.image-list li.active {
  background-color: var(--accent-color);
  color: white;
  font-weight: 500;
  border-color: var(--accent-color);
}

.history-panel h2 {
  margin-top: 0;
  font-size: 1.2rem;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.history-list li {
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
  color: var(--text-secondary);
}

.history-list li:hover {
  background-color: #f0f2f5;
}

.history-list li.active {
  background-color: var(--accent-color);
  color: white;
  font-weight: 500;
}
</style>
