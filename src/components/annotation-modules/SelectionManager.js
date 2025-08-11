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
    // 检查点击的是否为主形状，如果是，则选择其父group
    const targetGroup = e.target.name() === 'main-shape' ? e.target.getParent() : (e.target.getParent()?.name() === 'annotation-group' ? e.target.getParent() : null);

    if (targetGroup) {
      // 使用 meta/ctrl 键进行多选
      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      const isSelected = this.transformer.nodes().indexOf(targetGroup) >= 0;

      if (!metaPressed && !isSelected) {
        // 单选
        this.transformer.nodes([targetGroup]);
      } else if (metaPressed && isSelected) {
        // 从多选中移除
        const nodes = this.transformer.nodes().slice();
        nodes.splice(nodes.indexOf(targetGroup), 1);
        this.transformer.nodes(nodes);
      } else if (metaPressed && !isSelected) {
        // 添加到多选
        const nodes = this.transformer.nodes().concat([targetGroup]);
        this.transformer.nodes(nodes);
      }
      this.options.onSelectionChange(this.transformer.nodes());
    } else if (e.target.getLayer() === this.annotationLayer) {
      this.transformer.nodes([]);
      this.options.onSelectionChange([]);
    }
  }

  /**
   * 为形状（标注组）添加拖动约束和事件监听。
   * 使用 dragBoundFunc 来确保标注不会被拖出图片边界。
   * @param {Konva.Group} group
   */
  addDraggable(group) {
    group.draggable(true);
    // 让整组可在图片范围内自由拖动（包含标签与形状）
    group.dragBoundFunc((pos) => {
      // 使用图片边界进行限制，防止拖出图像区域
      const clamped = this.imageManager.getClampedPos(pos.x, pos.y);
      return { x: clamped.x, y: clamped.y };
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