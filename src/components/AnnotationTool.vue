<template>
  <div class="annotation-tool">
    <div class="controls">
      <!-- <label class="file-input-label">
        <i class="icon-upload"></i> 加载图片
        <input type="file" @change="loadImage" accept="image/*" class="file-input" />
      </label> -->
      <button @click="toggleDrawingMode('select')" :class="{ active: drawingMode === 'select' }">
        <i class="icon-select"></i> 选择
      </button>
      <button @click="toggleDrawingMode('rect')" :class="{ active: drawingMode === 'rect' }">
        <i class="icon-rect"></i>
      </button>
      <button @click="toggleDrawingMode('circle')" :class="{ active: drawingMode === 'circle' }">
        <i class="icon-circle"></i>
      </button>
      <button v-if="selectedAnnotations.length > 0" @click="deleteSelectedAnnotations" class="delete-button"
        title="Delete Selected">
        <i class="icon-clear"></i>
      </button>
      <button @click="undo" :disabled="!canUndo" title="Undo (Ctrl+Z)">
        <i class="icon-undo"></i>
      </button>
      <button @click="redo" :disabled="!canRedo" title="Redo (Ctrl+Y)">
        <i class="icon-redo"></i>
      </button>
      <button @click="clearAll" title="清空标注">
        <i class="icon-clear"></i>
      </button>
      <!-- <button @click="exportData" class="export-button">
        <i class="icon-export"></i> 导出标注
      </button> -->
      <button @click="exportImage" class="export-button">
        <i class="icon-image-export"></i> 导出图片
      </button>
    </div>
    <div ref="container" class="konva-container" :class="{
      'drawing': drawingMode === 'rect' || drawingMode === 'circle',
      'grabbing': isSpacePressed,
      'select-mode': drawingMode === 'select'
    }"></div>

    <!-- 标签选择弹窗 -->
    <a-modal :open="showLabelDialog" title="选择标签" @ok="confirmLabel" @cancel="cancelLabeling" :keyboard="true" centered
      :ok-button-props="{ disabled: !selectedLabelId }" ok-text="确认" cancel-text="取消">
      <div class="label-radio-group">
        <a-radio-group v-model:value="selectedLabelId">
          <a-radio v-for="(label, index) in availableLabels" :key="label.id" :value="label.id" class="label-radio-item">
            <span class="label-color-dot" :style="{ backgroundColor: label.color }"></span>
            {{ label.name }} ({{ index + 1 }})
          </a-radio>
        </a-radio-group>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import Konva from 'konva';
import { Modal, Radio } from 'ant-design-vue';
import StageManager from './annotation-modules/StageManager';
import ImageManager from './annotation-modules/ImageManager';
import DrawingManager from './annotation-modules/DrawingManager';
import AnnotationManager from './annotation-modules/AnnotationManager';
import SelectionManager from './annotation-modules/SelectionManager';
import HistoryManager from './annotation-modules/HistoryManager';

export default defineComponent({
  name: 'AnnotationTool',
  components: {
    'a-modal': Modal,
    'a-radio': Radio,
    'a-radio-group': Radio.Group,
  },
  props: {
    enableZoom: {
      type: Boolean,
      default: true,
    },
    image: {
      type: String,
      default: '',
    },
    markData: {
      type: Array,
      default: () => [],
    },
    labels: {
      type: Array,
      default: () => [],
    },
  },

  data() {
    return {
      // Vue-managed state
      drawingMode: 'select', // Default to select mode
      isSpacePressed: false,
      showLabelDialog: false,
      availableLabels: [
        { id: 'person', name: '人', color: '#e74c3c' },
        { id: 'car', name: '车', color: '#3498db' },
        { id: 'dog', name: '狗', color: '#2ecc71' },
        { id: 'cat', name: '猫', color: '#f1c40f' },
        { id: 'bird', name: '鸟', color: '#9b59b6' },
        { id: 'building', name: '建筑', color: '#e67e22' },
        { id: 'tree', name: '树', color: '#27ae60' },
        { id: 'sign', name: '标志', color: '#8e44ad' },
      ],
      selectedLabelId: null,
      selectedAnnotations: [], // To track selected nodes for UI changes (e.g., delete button)

      // Non-reactive, managed by classes
      stageManager: null,
      imageManager: null,
      drawingManager: null,
      annotationManager: null,
      selectionManager: null,
      historyManager: null,

      // History for undo/redo is now managed by HistoryManager
      // history: [],
      // historyIndex: -1,

      // isDrawing: false, // now managed by DrawingManager
      currentShape: null, // Temp shape holder for labeling
      localMarkData: [],
      resizeObserver: null,
    };
  },

  computed: {
    canUndo() {
      return this.historyManager ? this.historyManager.historyIndex > 0 : false;
    },
    canRedo() {
      return this.historyManager ? this.historyManager.historyIndex < this.historyManager.history.length - 1 : false;
    }
  },

  watch: {
    enableZoom(newValue) {
      // This will be handled by the StageManager if we decide to make it dynamic
    },
    async image(newVal) {
      if (newVal && this.imageManager) {
        this.loadImageAndAnnotations(newVal, this.markData);
      }
    },
    markData: {
      handler(newData, oldData) {
        // Only reload if data has actually changed to avoid unnecessary re-renders
        if (JSON.stringify(newData) !== JSON.stringify(oldData)) {
          this.loadImageAndAnnotations(this.image, newData);
        }
      },
      deep: true,
      immediate: true,
    },
    labels: {
      handler(newLabels) {
        if (newLabels && newLabels.length > 0) {
          this.availableLabels = [...newLabels];
        }
      },
      deep: true,
      immediate: true,
    },
  },

  mounted() {
    this.initAnnotationTool();
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    if (this.$refs.container) {
      this.resizeObserver.observe(this.$refs.container);
    }
  },

  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.drawingManager?.resetCurrentShape();
    this.stageManager?.destroy();
    this.selectionManager?.destroy();
  },

  methods: {
    initAnnotationTool() {
      const container = this.$refs.container;
      if (!container) return;

      this.stageManager = new StageManager(container, this.enableZoom);
      this.imageManager = new ImageManager(this.stageManager);
      this.annotationManager = new AnnotationManager(this.stageManager, this.imageManager);

      this.historyManager = new HistoryManager((history) => {
        this.$emit('history-changed', history);
      });

      this.selectionManager = new SelectionManager(this.stageManager, this.imageManager, {
        onSelectionChange: (selectedNodes) => {
          this.selectedAnnotations = selectedNodes;
        },
        onTransformEnd: (actionName) => this.saveState(actionName),
      });

      this.drawingManager = new DrawingManager(this.stageManager, this.imageManager, {
        onDrawEnd: (shape) => {
          this.currentShape = shape; // Keep the shape temporarily for labeling
          this.openLabelDialog();
        },
      });

      const stage = this.stageManager.getStage();
      // Bind stage events to the drawing manager's handlers
      stage.on('mousedown', (e) => !this.isSpacePressed && this.drawingManager.handleMouseDown(e));
      stage.on('mousemove', this.drawingManager.handleMouseMove);
      stage.on('mouseup', this.drawingManager.handleMouseUp);

      // Initial load
      if (this.image) {
        this.loadImageAndAnnotations(this.image, this.markData);
      } else {
        this.historyManager.reset();
      }
    },

    async loadImageAndAnnotations(imageSrc, markData) {
      if (!imageSrc || !this.imageManager) return;

      try {
        await this.imageManager.loadImage(imageSrc);
        this.historyManager.reset();
        this.loadAnnotations(markData || []);
        this.saveState('Initial Load');
      } catch (error) {
        console.error("Error loading image and annotations:", error);
      }
    },

    loadAnnotations(annotations) {
      this.annotationManager.loadAnnotations(annotations, {
        onStateChange: (actionName) => this.saveState(actionName),
        addDraggable: (group) => this.selectionManager.addDraggable(group)
      });
    },

    toggleDrawingMode(mode) {
      if (this.drawingManager?.isDrawingInProgress()) {
        this.drawingManager.resetCurrentShape();
      }
      // Toggle mode: if same mode is clicked, set to 'select', otherwise set to new mode.
      this.drawingMode = this.drawingMode === mode ? 'select' : mode;
      this.drawingManager?.setDrawingMode(this.drawingMode);

      const isDrawing = this.drawingMode === 'rect' || this.drawingMode === 'circle';
      if (isDrawing) {
        this.selectionManager.getTransformer().nodes([]);
      }

      this.updateStageDraggable();
    },

    exportImage() {
      const stage = this.stageManager?.getStage();
      const originalImage = this.imageManager?.getOriginalImage();

      if (!stage || !originalImage) {
        console.error("Cannot export, required elements are missing.");
        return;
      }

      // 1. Get annotation data in a normalized format
      const annotations = this.annotationManager.getAnnotationsData();

      // 2. Create an offscreen stage
      const offscreenStage = new Konva.Stage({
        width: originalImage.width,
        height: originalImage.height,
      });

      const offscreenImageLayer = new Konva.Layer();
      const offscreenAnnotationLayer = new Konva.Layer();
      offscreenStage.add(offscreenImageLayer, offscreenAnnotationLayer);

      // 3. Add the original, unscaled image
      offscreenImageLayer.add(new Konva.Image({
        image: originalImage,
        width: originalImage.width,
        height: originalImage.height,
      }));

      // 4. Re-create annotations on the offscreen layer using the same manager method
      annotations.forEach(ann => {
        // Use a scale of 1 and zero position because we are drawing on the original-sized canvas
        const group = this.annotationManager.createAnnotationGroup(ann, {
          scale: 1,
          imagePosition: { x: 0, y: 0 }
        });

        if (group) {
          // Override specific properties for export
          group.draggable(false);
          const mainShape = group.findOne('.main-shape');
          if (mainShape) {
            mainShape.strokeWidth(4); // Ensure a consistent, visible stroke width
          }
          offscreenAnnotationLayer.add(group);
        }
      });

      const dataURL = offscreenStage.toDataURL({ pixelRatio: 1 });
      offscreenStage.destroy();
      return dataURL;
    },

    getAnnotations() {
      return this.annotationManager?.getAnnotationsData();
    },

    saveState(actionName) {
      const annotations = this.annotationManager.getAnnotationsData();
      this.historyManager.push(annotations, actionName);
    },

    undo() {
      const state = this.historyManager.undo();
      if (state) {
        this.loadAnnotations(state);
        this.selectionManager.getTransformer()?.nodes([]);
      }
    },

    redo() {
      const state = this.historyManager.redo();
      if (state) {
        this.loadAnnotations(state);
        this.selectionManager.getTransformer()?.nodes([]);
      }
    },

    clearAll() {
      this.historyManager.reset();
      this.loadAnnotations([]);
      this.imageManager?.resetView();
      this.saveState('Clear All');
    },

    updateStageDraggable() {
      const stage = this.stageManager?.getStage();
      if (stage) {
        // Stage is draggable when space is pressed OR when not in a drawing mode.
        const notInDrawMode = this.drawingMode !== 'rect' && this.drawingMode !== 'circle';
        stage.draggable(this.isSpacePressed || notInDrawMode);
      }
    },

    handleKeyDown(e) {
      if (e.key === ' ' && !this.isSpacePressed) {
        e.preventDefault();
        this.isSpacePressed = true;
        this.updateStageDraggable();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.deleteSelectedAnnotations();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          this.undo();
        } else if (e.key === 'y') {
          e.preventDefault();
          this.redo();
        }
        return
      }

      const targetTagName = e.target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(targetTagName)) {
        return;
      }

      const modeMap = {
        's': 'select',
        'r': 'rect',
        'c': 'circle',
      };

      const mode = modeMap[e.key.toLowerCase()];
      if (mode) {
        e.preventDefault();
        this.toggleDrawingMode(mode);
      }

      // Numeric keys for label selection
      const numKey = parseInt(e.key);
      if (!isNaN(numKey) && numKey >= 1 && numKey <= this.availableLabels.length) {
        e.preventDefault();
        if (this.showLabelDialog) {
          this.selectedLabelId = this.availableLabels[numKey - 1].id;
          this.confirmLabel();
        }
      }

      // ESC to close dialog or cancel drawing
      if (e.key === 'Escape') {
        e.preventDefault();
        if (this.showLabelDialog) {
          this.cancelLabeling();
        } else if (this.drawingManager?.isDrawingInProgress()) {
          this.drawingManager.resetCurrentShape();
        }
      }
    },

    handleKeyUp(e) {
      if (e.key === ' ') {
        e.preventDefault();
        this.isSpacePressed = false;
        this.updateStageDraggable();
      }
    },

    handleResize() {
      const originalImage = this.imageManager?.getOriginalImage();
      if (!this.stageManager || !originalImage) return;

      // 1. Get current annotations before resize
      const annotations = this.annotationManager.getAnnotationsData();

      // 2. Update stage and image view
      this.stageManager.updateSize();
      this.imageManager.resetView();

      // 3. Reload annotations, they will be recalculated for the new size
      this.loadAnnotations(annotations);
    },

    openLabelDialog() {
      this.showLabelDialog = true;
      this.selectedLabelId = null;
    },

    cancelLabeling() {
      this.drawingManager.resetCurrentShape(); // The drawing manager created the shape
      this.currentShape = null;
      this.showLabelDialog = false;
    },

    confirmLabel() {
      if (!this.selectedLabelId || !this.currentShape) {
        this.cancelLabeling();
        return;
      }
      const selectedLabel = this.availableLabels.find(l => l.id === this.selectedLabelId);
      if (!selectedLabel) {
        this.cancelLabeling();
        return;
      }

      const shape = this.currentShape;
      shape.stroke(selectedLabel.color);
      shape.name('main-shape'); // Assign a name for easier lookup

      const group = new Konva.Group({
        x: shape.x(),
        y: shape.y(),
        draggable: true,
        name: 'annotation-group',
      });

      // Reset shape's position relative to the group
      shape.position({ x: 0, y: 0 });
      group.add(shape);

      // Add label to the group
      const labelText = `${selectedLabel.name}${this.getLabelCount(selectedLabel.id)}`;
      this.annotationManager.addLabelToGroup(group, labelText, selectedLabel.color);

      // Add the completed group to the layer and selection manager
      this.annotationManager.annotationLayer.add(group);
      this.selectionManager.addDraggable(group);

      // Clean up and save state
      this.currentShape = null; // We've moved the shape into the group
      this.saveState(`Add ${selectedLabel.name}`);
      this.showLabelDialog = false;
      this.selectedLabelId = null;
    },

    getLabelCount(labelId) {
      const labelName = this.availableLabels.find(l => l.id === labelId)?.name;
      if (!labelName) return 1;

      let count = 0;
      this.annotationManager.annotationLayer.find('.label-text').forEach(text => {
          if (text.text().startsWith(labelName)) {
              const match = text.text().match(new RegExp(`^${labelName}(\\d+)$`));
              if (match) {
                  const num = parseInt(match[1]);
                  if (num > count) count = num;
              }
          }
      });
      return count + 1;
    },

    deleteSelectedAnnotations() {
      const transformer = this.selectionManager?.getTransformer();
      const selectedNodes = transformer?.nodes() || [];
      if (selectedNodes.length > 0) {
        selectedNodes.forEach(node => {
          node.destroy(); // Destroy the whole group
        });
        transformer.nodes([]);
        this.saveState(`Delete ${selectedNodes.length} item(s)`);
      }
    },

    loadStateFromHistory(index) {
      const state = this.historyManager.goToState(index);
      if (state) {
        this.loadAnnotations(state);
        this.selectionManager.getTransformer()?.nodes([]);
      }
    },

    loadImageAndAnnotationsWithHistory(newImageSrc, historyState) {
      if (!newImageSrc) return;

      this.selectionManager?.getTransformer()?.nodes([]);
      this.drawingManager?.resetCurrentShape();
      this.showLabelDialog = false;
      this.selectedLabelId = null;

      const stateToLoad = this.historyManager.setHistoryState(historyState || { history: [], historyIndex: 0 });

      if (this.imageManager) {
        this.imageManager.loadImage(newImageSrc).then(() => {
          this.loadAnnotations(stateToLoad || []);
        });
      }
    },
  },
  expose: ['getAnnotations', 'historyManager', 'loadStateFromHistory', 'loadImageAndAnnotationsWithHistory'],
});
</script>

<style scoped>
.annotation-tool {
  display: flex;
  width: 100%;
  height: 100%;
  background-color: #f7f9fa;
  overflow: hidden;
  position: relative;
}

.controls {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background-color: white;
  border-radius: 0.75rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  z-index: 10;
  border: 1px solid #e8e8e8;
}

button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 44px;
  padding: 0 1rem;
  gap: 0.5rem;
  border: none;
  border-radius: 0.5rem;
  background-color: transparent;
  color: #555;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  font-size: 0.9rem;
  font-weight: 500;
}

button:hover {
  background-color: #f0f2f5;
  color: #111;
}

button.active {
  background-color: #e0e6ff;
  color: #4a69ff;
}

button.active::before {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 3px;
  background-color: #4a69ff;
  border-radius: 2px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.delete-button {
  background-color: #ff4d4f;
  color: white;
}

.delete-button:hover {
  background-color: #e83a3d;
}

.export-button {
  background-color: #4a69ff;
  color: white;
}

.export-button:hover {
  background-color: #3b56e0;
}

.konva-container {
  flex-grow: 1;
  width: 100%;
  height: 100%;
  background-color: #f0f2f5;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.06) 1px, transparent 1px);
  background-size: 20px 20px;
}

.konva-container.drawing {
  cursor: crosshair;
}

.konva-container.grabbing {
  cursor: grab;
}

.konva-container.select-mode {
  cursor: default;
}

[class^="icon-"] {
  display: inline-block;
  width: 24px;
  /* Increased size */
  height: 24px;
  /* Increased size */
  background-color: currentColor;
}

.icon-rect,
.icon-circle,
.icon-export,
.icon-select,
.icon-image-export,
.icon-upload,
.icon-clear {
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.icon-rect {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>');
}

.icon-circle {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>');
}

.icon-export {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>');
}

.icon-select {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 2.5-7.5L21 9l-18-6z"></path></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 2.5-7.5L21 9l-18-6z"></path></svg>');
}

.icon-image-export {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path><line x1="16" y1="3" x2="22" y2="9"></line><line x1="10" y1="14" x2="22" y2="2"></line></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path><line x1="16" y1="3" x2="22" y2="9"></line><line x1="10" y1="14" x2="22" y2="2"></line></svg>');
}

.icon-upload {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>');
}

.icon-undo {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-left"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-left"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>');
}

.icon-redo {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-right"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-right"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>');
}

.icon-clear {
  -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>');
  mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>');
}

/* Ant Design Modal Styles */
.label-radio-group {
  padding: 1rem 0;
}

.label-radio-group .ant-radio-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.label-radio-item {
  display: flex;
  align-items: center;
  transition: all 0.2s ease-in-out;
  padding: 0.5rem;
  border-radius: 6px;
}

.label-radio-item:hover {
  background-color: #f0f2f5;
}

.label-color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 10px;
  vertical-align: middle;
}
</style>