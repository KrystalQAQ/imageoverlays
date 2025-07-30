import Konva from 'konva';

/**
 * 管理所有标注的创建、加载和数据转换。
 * 每个标注被实现为一个 Konva.Group，其中包含主形状和标签。
 */
class AnnotationManager {
  /**
   * @param {StageManager} stageManager - Stage 管理器的实例。
   * @param {ImageManager} imageManager - Image 管理器的实例。
   */
  constructor(stageManager, imageManager) {
    this.stageManager = stageManager;
    this.imageManager = imageManager;
    this.annotationLayer = stageManager.getAnnotationLayer();
  }

  /**
   * 加载并绘制所有标注。
   * @param {Array} annotations - 要加载的标注数据数组。
   * @param {object} options - 包含回调函数的选项。
   */
  loadAnnotations(annotations, { onStateChange = () => {}, addDraggable = () => {} }) {
    const transformer = this.annotationLayer.findOne('Transformer');
    this.annotationLayer.destroyChildren();
    if (transformer) {
      this.annotationLayer.add(transformer);
    }

    const originalImage = this.imageManager.getOriginalImage();
    if (!originalImage) return;

    const scale = this.imageManager.getImageSize().width / originalImage.width;
    const imagePosition = this.imageManager.getImagePosition();

    annotations.forEach(ann => {
      const group = this.createAnnotationGroup(ann, { scale, imagePosition });
      if (group) {
        group.on('dragend', () => onStateChange('Move'));
        group.on('transformend', () => onStateChange('Transform'));
        addDraggable(group);
        this.annotationLayer.add(group);
      }
    });
  }

  /**
   * 根据标注数据创建一个完整的标注组 (Konva.Group)。
   * @param {object} ann - 单个标注的数据。
   * @param {object} transform - 包含 scale 和 imagePosition 的变换信息。
   * @returns {Konva.Group | null}
   */
  createAnnotationGroup(ann, transform) {
    const { scale, imagePosition } = transform;
    const stageScale = this.stageManager.getStage().scaleX();
    const baseStrokeWidth = 2;

    const group = new Konva.Group({
      x: ann.x * scale + imagePosition.x,
      y: ann.y * scale + imagePosition.y,
      name: 'annotation-group',
    });

    let shape;
    const commonShapeAttrs = {
      x: 0,
      y: 0,
      stroke: ann.stroke,
      strokeWidth: baseStrokeWidth / stageScale,
      name: 'main-shape',
    };

    if (ann.type === 'rect') {
      shape = new Konva.Rect({
        ...commonShapeAttrs,
        width: ann.width * scale,
        height: ann.height * scale,
      });
    } else if (ann.type === 'circle') {
      shape = new Konva.Circle({
        ...commonShapeAttrs,
        radius: ann.radius * scale,
      });
    } else {
      return null;
    }
    group.add(shape);

    if (ann.label) {
      this.addLabelToGroup(group, ann.label, ann.stroke);
    }
    return group;
  }

  /**
   * 为指定的组添加文本标签和背景。
   * @param {Konva.Group} group - 目标组。
   * @param {string} textContent - 标签的文本内容。
   * @param {string} color - 标签颜色。
   */
  addLabelToGroup(group, textContent, color) {
    const text = new Konva.Text({
        x: 0,
        y: 0,
        text: textContent,
        fontSize: 14,
        fontFamily: 'Arial',
        fill: 'white',
        padding: 5,
        listening: false,
        name: 'label-text',
    });

    const textBackground = new Konva.Rect({
        x: 0,
        y: 0,
        name: 'label-background',
        fill: color || 'black',
        opacity: 0.8,
        cornerRadius: 3,
        listening: false,
    });

    textBackground.width(text.width());
    textBackground.height(text.height());

    // 标签默认放在组的左上角
    group.add(textBackground, text);
  }

  /**
   * 将当前所有标注转换为可导出的数据格式。
   * @returns {Array}
   */
  getAnnotationsData() {
    const originalImage = this.imageManager.getOriginalImage();
    const imageSize = this.imageManager.getImageSize();
    if (!originalImage || imageSize.width === 0) return [];

    const scale = imageSize.width / originalImage.width;
    const imagePosition = this.imageManager.getImagePosition();
    const annotations = [];

    this.annotationLayer.find('.annotation-group').forEach(group => {
      const mainShape = group.findOne('.main-shape');
      if (!mainShape) return;

      const relativePos = {
        x: (group.x() - imagePosition.x) / scale,
        y: (group.y() - imagePosition.y) / scale,
      };

      let annotation = {
        ...relativePos,
        stroke: mainShape.stroke(),
      };

      if (mainShape instanceof Konva.Rect) {
        annotation.type = 'rect';
        annotation.width = mainShape.width() / scale;
        annotation.height = mainShape.height() / scale;
      } else if (mainShape instanceof Konva.Circle) {
        annotation.type = 'circle';
        annotation.radius = mainShape.radius() / scale;
      }

      const textShape = group.findOne('.label-text');
      if (textShape) {
        annotation.label = textShape.text();
      }
      annotations.push(annotation);
    });
    return annotations;
  }

  /**
   * 根据标注组查找其关联的标签文本节点。
   * @param {Konva.Group} group - 目标组。
   * @returns {Konva.Text | undefined}
   */
  findAssociatedText(group) {
      return group.findOne('.label-text');
  }

  /**
   * 根据文本节点查找其关联的标签背景矩形。
   * @param {Konva.Text} textShape - 目标文本节点。
   * @returns {Konva.Rect | undefined}
   */
  findAssociatedLabelBackground(textShape) {
    if (!textShape || !textShape.getParent()) return undefined;
    return textShape.getParent().findOne('.label-background');
  }

  /**
   * 销毁所有标注。
   */
  destroy() {
      this.annotationLayer.find('.annotation-group').destroy();
  }
}

export default AnnotationManager;