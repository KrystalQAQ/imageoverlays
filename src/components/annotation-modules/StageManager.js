class StageManager {
  constructor(container, enableZoom = true) {
    if (!container) {
      throw new Error('Container is required to initialize StageManager.');
    }
    this.container = container;
    this.stage = new Konva.Stage({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      draggable: true,
    });

    this.imageLayer = new Konva.Layer();
    this.annotationLayer = new Konva.Layer();
    this.stage.add(this.imageLayer, this.annotationLayer);

    if (enableZoom) {
      this.stage.on('wheel', this.handleWheel.bind(this));
    }
  }

  getStage() {
    return this.stage;
  }

  getImageLayer() {
    return this.imageLayer;
  }

  getAnnotationLayer() {
    return this.annotationLayer;
  }

  updateSize() {
    if (!this.container) return;
    this.stage.width(this.container.clientWidth);
    this.stage.height(this.container.clientHeight);
  }

  setDraggable(draggable) {
    this.stage.draggable(draggable);
  }

  handleWheel(e) {
    e.evt.preventDefault();
    const stage = this.stage;
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

    // Adjust stroke width of annotations
    const baseStrokeWidth = 2;
    this.annotationLayer.children.forEach(shape => {
      if (shape instanceof Konva.Transformer) return;
      shape.strokeWidth(baseStrokeWidth / newScale);
    });
  }

  destroy() {
    this.stage.destroy();
  }
}

export default StageManager;