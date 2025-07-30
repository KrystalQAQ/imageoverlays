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
      <button @click="undo" :disabled="historyIndex <= 0" title="Undo (Ctrl+Z)">
        <i class="icon-undo"></i>
      </button>
      <button @click="redo" :disabled="historyIndex >= history.length - 1" title="Redo (Ctrl+Y)">
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
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import Konva from 'konva';

export default defineComponent({
  name: 'AnnotationTool',
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
  },

  data() {
    return {
      imageSrc: null,
      drawingMode: 'select', // Default to select mode
      imagePosition: { x: 0, y: 0 },
      imageSize: { width: 0, height: 0 },
      isSpacePressed: false,
      originalImage: null,
      resizeObserver: null,

      // History for undo/redo
      history: [],
      historyIndex: -1,

      // Konva Transformer for selection
      transformer: null,

      // Non-reactive Konva instances
      stage: null,
      imageLayer: null,
      annotationLayer: null,
      isDrawing: false,
      startPoint: { x: 0, y: 0 },
      currentShape: null,
      localMarkData: [],
    };
  },

  watch: {
    enableZoom(newValue) {
      if (!this.stage) return;
      if (newValue) {
        this.stage.on('wheel', this.handleWheel);
      } else {
        this.stage.off('wheel');
      }
    },
    image(newVal) {
      if (newVal) {
        this.imageSrc = newVal;
        this.drawImage();
      }
    },
    markData: {
      handler(newData) {
        this.localMarkData = JSON.parse(JSON.stringify(newData || []));
        if (this.originalImage) {
          this.loadAnnotations(this.localMarkData);
        }
      },
      deep: true,
      immediate: true,
    },
  },

  mounted() {
    this.initKonva();
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
  },

  methods: {
    initKonva() {
      const container = this.$refs.container;
      if (container) {
        const stageWidth = container.clientWidth;
        const stageHeight = container.clientHeight;
        this.stage = new Konva.Stage({
          container,
          width: stageWidth,
          height: stageHeight,
          draggable: true,
        });

        if (this.enableZoom) {
          this.stage.on('wheel', this.handleWheel);
        }
        this.stage.on('mousedown', this.handleMouseDown);
        this.stage.on('mousemove', this.handleMouseMove);
        this.stage.on('mouseup', this.handleMouseUp);
        this.stage.on('click tap', this.handleStageClick); // For selection

        this.transformer = new Konva.Transformer({
            keepRatio: true,
            boundBoxFunc: (oldBox, newBox) => {
                if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                }
                return newBox;
            },
        });
      }
    },

    handleWheel(e) {
        e.evt.preventDefault();
        const stage = this.stage;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY > 0 ? oldScale * 1.1 : oldScale / 1.1;
        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);

        if (this.annotationLayer) {
            const baseStrokeWidth = 2;
            this.annotationLayer.children.forEach(shape => {
                shape.strokeWidth(baseStrokeWidth / newScale);
            });
        }
    },

    loadImage(event) {
      const target = event.target;
      if (target.files && target.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imageSrc = e.target?.result;
          this.drawImage();
        };
        reader.readAsDataURL(target.files[0]);
      }
    },

    drawImage() {
      if (!this.imageSrc || !this.stage) return;
      const image = new Image();
      this.originalImage = image; // Store original image object
      image.src = this.imageSrc;
      image.onload = () => {
        if (!this.stage) return;
        this.stage.position({ x: 0, y: 0 });
        this.stage.scale({ x: 1, y: 1 });

        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        const scale = Math.min(stageWidth / image.width, stageHeight / image.height);

        this.imageSize = { width: image.width * scale, height: image.height * scale };
        this.imagePosition = { x: (stageWidth - this.imageSize.width) / 2, y: (stageHeight - this.imageSize.height) / 2 };

        if (this.imageLayer) this.imageLayer.destroy();
        this.imageLayer = new Konva.Layer();
        this.stage.add(this.imageLayer);

        const konvaImage = new Konva.Image({
          ...this.imagePosition,
          ...this.imageSize,
          image: image,
          name: 'background-image',
        });
        this.imageLayer.add(konvaImage);

        if (this.annotationLayer) this.annotationLayer.destroy();
        this.annotationLayer = new Konva.Layer();
        this.stage.add(this.annotationLayer);

        if (this.localMarkData && this.localMarkData.length > 0) {
            this.loadAnnotations(this.localMarkData);
        }
        this.saveState();
      };
    },

    toggleDrawingMode(mode) {
      this.drawingMode = this.drawingMode === mode ? null : mode;
      this.updateStageDraggable();
      this.updateShapesDraggable();
    },

    updateShapesDraggable() {
        if (!this.annotationLayer) return;
        const isDraggable = this.drawingMode === 'select' || this.drawingMode === null;
        this.annotationLayer.children.forEach(shape => {
            shape.draggable(isDraggable);
        });
    },

    exportData() {
        if (!this.annotationLayer || !this.originalImage || this.imageSize.width === 0) return;

        const scale = this.imageSize.width / this.originalImage.width;

        const annotations = this.annotationLayer.children.map(shape => {
            const { x = 0, y = 0, width = 0, height = 0, radius = 0, ...attrs } = shape.getAttrs();

            const relativePos = {
                x: (x - this.imagePosition.x) / scale,
                y: (y - this.imagePosition.y) / scale
            }

            if (shape instanceof Konva.Rect) {
                return { type: 'rect', ...relativePos, width: width / scale, height: height / scale, stroke: attrs.stroke };
            } else if (shape instanceof Konva.Circle) {
                return { type: 'circle', ...relativePos, radius: radius / scale, stroke: attrs.stroke };
            }
            return null;
        }).filter(Boolean);

        const dataStr = JSON.stringify(annotations, null, 2);
        console.log(dataStr);
        // const dataBlob = new Blob([dataStr], { type: 'application/json' });
        // const url = URL.createObjectURL(dataBlob);
        // const link = document.createElement('a');
        // link.href = url;
        // link.download = 'annotations.json';
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);
        // URL.revokeObjectURL(url);
    },

    exportImage() {
      if (!this.stage || !this.originalImage || !this.annotationLayer) {
        console.error("Cannot export, required elements are missing.");
        return;
      }

      // 1. Create a temporary container for the offscreen stage
      const tempContainer = document.createElement('div');
      tempContainer.style.display = 'none';
      document.body.appendChild(tempContainer);

      // 2. Create the offscreen stage with original image dimensions
      const offscreenStage = new Konva.Stage({
        container: tempContainer,
        width: this.originalImage.width,
        height: this.originalImage.height,
      });

      // 3. Add layers for image and annotations
      const imageLayer = new Konva.Layer();
      const annotationLayer = new Konva.Layer();
      offscreenStage.add(imageLayer, annotationLayer);

      // 4. Add the original, unscaled image
      imageLayer.add(new Konva.Image({
        image: this.originalImage,
        x: 0,
        y: 0,
        width: this.originalImage.width,
        height: this.originalImage.height,
      }));

      // 5. Calculate scale factor between displayed and original image
      const scale = this.imageSize.width / this.originalImage.width;

      // 6. Copy annotations, transforming them to original resolution
      this.annotationLayer.children.forEach(shape => {
        const { x = 0, y = 0, width = 0, height = 0, radius = 0, ...attrs } = shape.getAttrs();

        const baseAttrs = {
          ...attrs,
          x: (x - this.imagePosition.x) / scale,
          y: (y - this.imagePosition.y) / scale,
          strokeWidth: 4,
          draggable: false,
        };

        if (shape instanceof Konva.Rect) {
          const newShape = new Konva.Rect({
            ...baseAttrs,
            width: width / scale,
            height: height / scale,
          });
          annotationLayer.add(newShape);
        } else if (shape instanceof Konva.Circle) {
          const newShape = new Konva.Circle({
            ...baseAttrs,
            radius: radius / scale,
          });
          annotationLayer.add(newShape);
        }
      });

      // 7. Generate Data URL from the offscreen stage
      const dataURL = offscreenStage.toDataURL({ pixelRatio: 1 });
      console.log(dataURL);
      return dataURL;
      // 8. Trigger download
      // const link = document.createElement('a');
      // link.href = dataURL;
      // link.download = 'annotated-image-original.png';
      // document.body.appendChild(link);
      // link.click();
      // document.body.removeChild(link);

      // // 9. Cleanup
      // offscreenStage.destroy();
      // document.body.removeChild(tempContainer);
    },

    getAnnotations() {
        if (!this.annotationLayer || !this.originalImage || !this.imageSize.width === 0) return [];

        const scale = this.imageSize.width / this.originalImage.width;

        const annotations = this.annotationLayer.children.map(shape => {
            if (shape instanceof Konva.Transformer) return null;
            const { x = 0, y = 0, width = 0, height = 0, radius = 0, ...attrs } = shape.getAttrs();

            const relativePos = {
                x: (x - this.imagePosition.x) / scale,
                y: (y - this.imagePosition.y) / scale
            }

            if (shape instanceof Konva.Rect) {
                return { type: 'rect', ...relativePos, width: width / scale, height: height / scale, stroke: attrs.stroke };
            } else if (shape instanceof Konva.Circle) {
                return { type: 'circle', ...relativePos, radius: radius / scale, stroke: attrs.stroke };
            }
            return null;
        }).filter(Boolean);

        return annotations;
    },

    loadImageAndAnnotations(newImageSrc, newMarkData) {
        if (!newImageSrc) return;

        // Reset state for new image
        this.history = [];
        this.historyIndex = -1;
        this.transformer?.nodes([]);

        this.imageSrc = newImageSrc;
        this.localMarkData = newMarkData || [];

        this.drawImage();
    },

    saveState() {
        const annotations = this.getAnnotations();
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(annotations);
        this.historyIndex++;
        this.$emit('history-changed', this.history.map((_, i) => ({ id: i, active: i === this.historyIndex })));

    },

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadAnnotations(this.history[this.historyIndex]);
            this.transformer?.nodes([]);
             this.$emit('history-changed', this.history.map((_, i) => ({ id: i, active: i === this.historyIndex })));
        }
    },

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadAnnotations(this.history[this.historyIndex]);
            this.transformer?.nodes([]);
            this.$emit('history-changed', this.history.map((_, i) => ({ id: i, active: i === this.historyIndex })));
        }
    },

    loadStateFromHistory(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            this.loadAnnotations(this.history[this.historyIndex]);
            this.transformer?.nodes([]);
            this.$emit('history-changed', this.history.map((_, i) => ({ id: i, active: i === this.historyIndex })));
        }
    },

    clearAll() {
        this.loadAnnotations([]);
        this.resetImageView();

        this.history = [];
        this.historyIndex = -1;
        this.saveState(); // new empty state
    },

    resetImageView() {
        if (!this.stage || !this.originalImage) return;

        this.stage.position({ x: 0, y: 0 });
        this.stage.scale({ x: 1, y: 1 });

        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        const scale = Math.min(stageWidth / this.originalImage.width, stageHeight / this.originalImage.height);

        this.imageSize = { width: this.originalImage.width * scale, height: this.originalImage.height * scale };
        this.imagePosition = { x: (stageWidth - this.imageSize.width) / 2, y: (stageHeight - this.imageSize.height) / 2 };

        const konvaImage = this.imageLayer?.findOne('.background-image');
        if (konvaImage) {
            konvaImage.setAttrs({
                ...this.imagePosition,
                ...this.imageSize,
            });
        }

        if (this.annotationLayer) {
            const baseStrokeWidth = 2;
            this.annotationLayer.children.forEach(shape => {
                if (shape instanceof Konva.Transformer) return;
                shape.strokeWidth(baseStrokeWidth / 1.0);
            });
        }
    },

    getClampedPos(x, y) {
      return {
        x: Math.max(this.imagePosition.x, Math.min(x, this.imagePosition.x + this.imageSize.width)),
        y: Math.max(this.imagePosition.y, Math.min(y, this.imagePosition.y + this.imageSize.height)),
      };
    },

    handleMouseDown(e) {
      if (this.isSpacePressed) return; // Prevent drawing when panning
      if (this.drawingMode === null || this.drawingMode === 'select') {
        return;
      }
      this.isDrawing = true;

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      const scale = this.stage.scaleX();
      const stagePos = { x: (pos.x - this.stage.x()) / scale, y: (pos.y - this.stage.y()) / scale };

      this.startPoint = this.getClampedPos(stagePos.x, stagePos.y);

      const baseStrokeWidth = 2;
      const componentThis = this;
      const commonAttrs = {
        ...this.startPoint,
        strokeWidth: baseStrokeWidth / scale,
        draggable: true,
      };

      if (this.drawingMode === 'rect') {
        this.currentShape = new Konva.Rect({
          ...commonAttrs,
          width: 0,
          height: 0,
          stroke: '#e74c3c',
        });
        this.currentShape.on('dragmove', this.handleShapeDrag);

      } else {
        this.currentShape = new Konva.Circle({
          ...commonAttrs,
          radius: 0,
          stroke: '#3498db',
        });
        this.currentShape.on('dragmove', this.handleShapeDrag);
      }
      this.annotationLayer?.add(this.currentShape);
    },

    handleMouseMove(e) {
      if (!this.isDrawing || !this.currentShape || !this.stage) return;

      const pos = this.stage.getPointerPosition();
      if (!pos) return;

      const scale = this.stage.scaleX();
      const stagePos = { x: (pos.x - this.stage.x()) / scale, y: (pos.y - this.stage.y()) / scale };
      const point = this.getClampedPos(stagePos.x, stagePos.y);

      if (this.currentShape instanceof Konva.Rect) {
        this.currentShape.width(point.x - this.startPoint.x);
        this.currentShape.height(point.y - this.startPoint.y);
      } else if (this.currentShape instanceof Konva.Circle) {
        const dx = point.x - this.startPoint.x;
        const dy = point.y - this.startPoint.y;
        this.currentShape.radius(Math.sqrt(dx * dx + dy * dy));
      }
    },

    handleMouseUp() {
      if (this.isDrawing) {
        this.isDrawing = false;

        const shape = this.currentShape;
        if (shape instanceof Konva.Rect) {
            if (shape.width() < 0) {
                shape.x(shape.x() + shape.width());
                shape.width(-shape.width());
            }
            if (shape.height() < 0) {
                shape.y(shape.y() + shape.height());
                shape.height(-shape.height());
            }
        }

        this.currentShape = null;
        this.updateShapesDraggable();
        this.saveState();
      }
    },

    updateStageDraggable() {
        if (this.stage) {
            this.stage.draggable(this.isSpacePressed || this.drawingMode === null || this.drawingMode === 'select');
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
            const selectedNodes = this.transformer?.nodes() || [];
            if (selectedNodes.length > 0) {
                selectedNodes.forEach(node => node.destroy());
                this.transformer.nodes([]);
                this.saveState();
            }
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
    },

    handleKeyUp(e) {
        if (e.key === ' ') {
            e.preventDefault();
            this.isSpacePressed = false;
            this.updateStageDraggable();
        }
    },

    loadAnnotations(annotations) {
      if (!this.annotationLayer || !this.originalImage || this.imageSize.width === 0) {
        return;
      }

      this.annotationLayer.destroyChildren();

      if (this.transformer) {
        this.transformer.destroy();
      }
      this.transformer = new Konva.Transformer({
          keepRatio: true,
          boundBoxFunc: (oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
              }
              return newBox;
          },
      });
      this.annotationLayer.add(this.transformer);


      const scale = this.imageSize.width / this.originalImage.width;
      const stageScale = this.stage.scaleX();
      const baseStrokeWidth = 2;
      const componentThis = this;

      annotations.forEach(ann => {
        const commonAttrs = {
          x: ann.x * scale + this.imagePosition.x,
          y: ann.y * scale + this.imagePosition.y,
          stroke: ann.stroke || (ann.type === 'rect' ? '#e74c3c' : '#3498db'),
          strokeWidth: baseStrokeWidth / stageScale,
          draggable: true,
        };

        let shape;
        if (ann.type === 'rect') {
          shape = new Konva.Rect({
            ...commonAttrs,
            width: ann.width * scale,
            height: ann.height * scale,
          });
        } else if (ann.type === 'circle') {
          shape = new Konva.Circle({
            ...commonAttrs,
            radius: ann.radius * scale,
          });
        }

        if (shape) {
          shape.on('dragmove', this.handleShapeDrag);
          shape.on('dragend', () => this.saveState());
          shape.on('transformend', () => this.saveState());
          this.annotationLayer.add(shape);
        }
      });
      this.updateShapesDraggable();
    },

    handleShapeDrag(e) {
      const shape = e.target;
      const stage = this.stage;
      if (!stage) return;

      const image = stage.findOne('.background-image');
      if (!image) return;

      const imageBox = image.getClientRect();
      let shapeBox = shape.getClientRect();

      let correctedX = shape.x();
      let correctedY = shape.y();

      const dx = shape.x() - shapeBox.x / stage.scaleX();
      const dy = shape.y() - shapeBox.y / stage.scaleY();

      if (shapeBox.x < imageBox.x) {
        correctedX = imageBox.x / stage.scaleX() + dx;
      }
      if (shapeBox.y < imageBox.y) {
        correctedY = imageBox.y / stage.scaleY() + dy;
      }
      if (shapeBox.x + shapeBox.width > imageBox.x + imageBox.width) {
        correctedX = (imageBox.x + imageBox.width - shapeBox.width) / stage.scaleX() + dx;
      }
      if (shapeBox.y + shapeBox.height > imageBox.y + imageBox.height) {
        correctedY = (imageBox.y + imageBox.height - shapeBox.height) / stage.scaleY() + dy;
      }

      shape.x(correctedX);
      shape.y(correctedY);
    },

    getDragBoundFunc() {
      return function(pos) {
        const shape = this;
        const stage = shape.getStage();
        if (!stage) return pos;

        const image = stage.findOne('.background-image');
        if (!image) return pos;

        // Use absolute position for dragBoundFunc as it's relative to the screen
        const absPos = shape.getAbsolutePosition();
        const offsetX = absPos.x - pos.x;
        const offsetY = absPos.y - pos.y;

        const imageRect = image.getClientRect(); // This is the boundary in absolute coordinates

        let newAbsX, newAbsY;
        const halfStroke = shape.strokeWidth() / 2;

        if (shape instanceof Konva.Rect) {
            const shapeBox = shape.getClientRect({ relativeTo: stage });
            newAbsX = Math.max(imageRect.x + halfStroke, pos.x);
            newAbsX = Math.min(newAbsX, imageRect.x + imageRect.width - shapeBox.width - halfStroke);

            newAbsY = Math.max(imageRect.y + halfStroke, pos.y);
            newAbsY = Math.min(newAbsY, imageRect.y + imageRect.height - shapeBox.height - halfStroke);
        } else if (shape instanceof Konva.Circle) {
            const radius = shape.radius();
            const effectiveRadius = radius + halfStroke;
            newAbsX = Math.max(imageRect.x + effectiveRadius, pos.x);
            newAbsX = Math.min(newAbsX, imageRect.x + imageRect.width - effectiveRadius);

            newAbsY = Math.max(imageRect.y + effectiveRadius, pos.y);
            newAbsY = Math.min(newAbsY, imageRect.y + imageRect.height - effectiveRadius);
        } else {
            return pos;
        }

        return {
            x: newAbsX - offsetX,
            y: newAbsY - offsetY,
        };
      };
    },

    handleResize() {
      const container = this.$refs.container;
      if (!container || !this.stage || !this.originalImage) return;

      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;

      const oldImagePos = { ...this.imagePosition };
      const oldImageSize = { ...this.imageSize };

      this.stage.width(newWidth);
      this.stage.height(newHeight);

      const scale = Math.min(newWidth / this.originalImage.width, newHeight / this.originalImage.height);
      this.imageSize = { width: this.originalImage.width * scale, height: this.originalImage.height * scale };
      this.imagePosition = {
        x: (newWidth - this.imageSize.width) / 2,
        y: (newHeight - this.imageSize.height) / 2,
      };

      const konvaImage = this.imageLayer?.findOne('Image');
      if (konvaImage) {
        konvaImage.setAttrs({
          ...this.imagePosition,
          ...this.imageSize,
        });
      }

      if (this.annotationLayer && oldImageSize.width > 0) {
        const scaleRatio = this.imageSize.width / oldImageSize.width;

        this.annotationLayer.children.forEach(shape => {
            if (shape instanceof Konva.Transformer) return;
          const relX = shape.x() - oldImagePos.x;
          const relY = shape.y() - oldImagePos.y;

          shape.x(relX * scaleRatio + this.imagePosition.x);
          shape.y(relY * scaleRatio + this.imagePosition.y);

          if (shape instanceof Konva.Rect) {
            shape.width(shape.width() * scaleRatio);
            shape.height(shape.height() * scaleRatio);
          } else if (shape instanceof Konva.Circle) {
            shape.radius(shape.radius() * scaleRatio);
          }
        });
      }
    },

    handleStageClick(e) {
      if (this.drawingMode === 'select' || this.drawingMode === null) {
        if (e.target === this.stage) {
          this.transformer.nodes([]);
          return;
        }

        if (e.target.getParent() === this.annotationLayer) {
          this.transformer.nodes([e.target]);
        }
      }
    },
  },
  expose: ['loadStateFromHistory', 'getAnnotations', 'loadImageAndAnnotations'],
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
  width: 24px; /* Increased size */
  height: 24px; /* Increased size */
  background-color: currentColor;
}

.icon-rect, .icon-circle, .icon-export, .icon-select, .icon-image-export, .icon-upload, .icon-clear {
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

.icon-rect { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>'); }
.icon-circle { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>'); }
.icon-export { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'); }
.icon-select { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 2.5-7.5L21 9l-18-6z"></path></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 2.5-7.5L21 9l-18-6z"></path></svg>'); }
.icon-image-export { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path><line x1="16" y1="3" x2="22" y2="9"></line><line x1="10" y1="14" x2="22" y2="2"></line></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"></path><line x1="16" y1="3" x2="22" y2="9"></line><line x1="10" y1="14" x2="22" y2="2"></line></svg>');}
.icon-upload { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>');}
.icon-undo { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-left"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-left"><polyline points="9 14 4 9 9 4"></polyline><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>'); }
.icon-redo { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-right"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-corner-up-right"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>'); }
.icon-clear { -webkit-mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>'); mask-image: url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>'); }
</style>