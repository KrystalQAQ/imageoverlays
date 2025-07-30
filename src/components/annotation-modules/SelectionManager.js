import Konva from 'konva';

/**
 * 管理标注的选择、变换和拖动。
 */
class SelectionManager {
  /**
   * @param {StageManager} stageManager
   * @param {ImageManager} imageManager
   * @param {object} options
   * @param {function} options.onSelectionChange - 选中项变化时的回调
   * @param {function} options.onTransformEnd - 变换结束时的回调
   */
  constructor(stageManager, imageManager, options) {
    this.stageManager = stageManager;
    this.imageManager = imageManager;
    this.annotationLayer = stageManager.getAnnotationLayer();
    this.options = {
      onSelectionChange: () => {},
      onTransformEnd: () => {},
      ...options
    };

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

    this.stageManager.getStage().on('click tap', this.handleStageClick.bind(this));
  }

  handleStageClick(e) {
    const stage = this.stageManager.getStage();
    // 如果点击的是舞台本身，则取消所有选择
    if (e.target === stage) {
      this.transformer.nodes([]);
      this.options.onSelectionChange([]);
      return;
    }

    // 忽略点击 transformer 自身
    if (e.target.getParent() instanceof Konva.Transformer) {
      return;
    }

    // 如果点击的是标注图层中的形状
    if (e.target.getLayer() === this.annotationLayer) {
        // 使用 meta/ctrl 键进行多选
      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      const isSelected = this.transformer.nodes().indexOf(e.target) >= 0;

      if (!metaPressed && !isSelected) {
        // 单选
        this.transformer.nodes([e.target]);
      } else if (metaPressed && isSelected) {
        // 从多选中移除
        const nodes = this.transformer.nodes().slice();
        nodes.splice(nodes.indexOf(e.target), 1);
        this.transformer.nodes(nodes);
      } else if (metaPressed && !isSelected) {
        // 添加到多选
        const nodes = this.transformer.nodes().concat([e.target]);
        this.transformer.nodes(nodes);
      }
      this.options.onSelectionChange(this.transformer.nodes());
    }
  }

  /**
   * 为形状（标注组）添加拖动约束和事件监听。
   * 使用 dragBoundFunc 来确保标注不会被拖出图片边界。
   * @param {Konva.Group} group
   */
  addDraggable(group) {
    group.draggable(true);

    group.dragBoundFunc((pos) => {
        const image = this.imageManager.getKonvaImage();
        const imageBox = {
            x1: image.x(),
            x2: image.x() + image.width(),
            y1: image.y(),
            y2: image.y() + image.height()
        };

        const { width, height } = group.getClientRect({ relativeTo: group.getParent() });

        const newX = Math.max(imageBox.x1, Math.min(pos.x, imageBox.x2 - width));
        const newY = Math.max(imageBox.y1, Math.min(pos.y, imageBox.y2 - height));

        return { x: newX, y: newY };
    });

    group.on('dragend', () => this.options.onTransformEnd('Move'));
    group.on('transformend', () => this.options.onTransformEnd('Transform'));
  }

  getTransformer() {
    return this.transformer;
  }

  destroy() {
    this.transformer.destroy();
    // Remove event listeners if any were added to the stage directly
  }
}

export default SelectionManager;