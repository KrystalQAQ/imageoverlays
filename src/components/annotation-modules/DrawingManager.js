import Konva from 'konva';

/**
 * 管理标注绘制过程的模块。
 * 负责处理鼠标事件以创建新的形状。
 */
class DrawingManager {
    /**
     * @param {StageManager} stageManager - Stage 管理器的实例。
     * @param {ImageManager} imageManager - Image 管理器的实例。
     * @param {object} options - 配置选项。
     * @param {function} options.onDrawStart - 开始绘制时的回调函数。
     * @param {function} options.onDrawEnd - 结束绘制时的回调函数，返回最终的形状。
     */
    constructor(stageManager, imageManager, options) {
        this.stageManager = stageManager;
        this.imageManager = imageManager;
        this.stage = stageManager.getStage();
        this.annotationLayer = stageManager.getAnnotationLayer();

        // 合并默认选项和用户传入的选项
        this.options = {
            onDrawStart: () => { },
            onDrawEnd: () => { },
            ...options,
        };

        this.isDrawing = false; // 标志位：是否正在绘制中
        this.drawingMode = null; // 当前的绘制模式 ('rect', 'circle', null)
        this.startPoint = { x: 0, y: 0 }; // 绘制起始点
        this.currentShape = null; // 当前正在绘制的 Konva 形状对象

        // 绑定核心事件处理函数，确保 'this' 上下文正确
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
    }

    /**
     * 设置当前的绘制模式。
     * @param {string | null} mode - 'rect', 'circle' 或 null。
     */
    setDrawingMode(mode) {
        this.drawingMode = mode;
    }

    /**
     * 检查当前是否正在进行绘制。
     * @returns {boolean}
     */
    isDrawingInProgress() {
        return this.isDrawing;
    }

    /**
     * 获取当前正在绘制的形状。
     * @returns {Konva.Shape | null}
     */
    getCurrentShape() {
        return this.currentShape;
    }

    /**
     * 重置/销毁当前正在绘制的形状，并取消绘制状态。
     * 这通常在取消操作或完成一次绘制后调用。
     */
    resetCurrentShape() {
        if (this.currentShape) {
            try {
                this.currentShape.destroy();
            } catch (error) {
                console.warn('销毁当前形状时出错:', error);
            }
            this.currentShape = null;
        }
        this.isDrawing = false;
    }

    /**
     * 处理鼠标按下事件，开始绘制。
     * @param {object} e - Konva 事件对象。
     */
    handleMouseDown(e) {
        // console.log(e);
        // 仅在设置了绘制模式（非选择模式）时才触发
        if (!this.drawingMode || this.drawingMode === 'select') {
            return;
        }

        // 允许在舞台或背景图片上开始绘制，但在其他形状（如已有标注）上则不允许。
        const targetName = e.target.name();
        if (e.target !== this.stage && targetName !== 'background-image') {
            return;
        }

        this.isDrawing = true;
        const pos = this.stage.getPointerPosition();
        if (!pos) return;

        // 将屏幕坐标转换为舞台坐标（考虑缩放和位移）
        const scale = this.stage.scaleX();
        const stagePos = { x: (pos.x - this.stage.x()) / scale, y: (pos.y - this.stage.y()) / scale };

        // 将绘制点限制在图片范围内
        this.startPoint = this.imageManager.getClampedPos(stagePos.x, stagePos.y);

        const baseStrokeWidth = 2;
        const commonAttrs = {
            ...this.startPoint,
            strokeWidth: baseStrokeWidth / scale, // 根据缩放调整描边宽度
            draggable: true, // 初始可拖拽，完成时再禁用
        };

        // 根据绘制模式创建不同的形状
        if (this.drawingMode === 'rect') {
            this.currentShape = new Konva.Rect({
                ...commonAttrs,
                width: 0,
                height: 0,
                stroke: '#e74c3c', // 默认为红色
            });
        } else if (this.drawingMode === 'circle') {
            this.currentShape = new Konva.Circle({
                ...commonAttrs,
                radius: 0,
                stroke: '#3498db', // 默认为蓝色
            });
        }

        // 将新形状添加到标注图层并触发回调
        if (this.currentShape) {
            this.annotationLayer.add(this.currentShape);
            this.options.onDrawStart(this.currentShape);
        }
    }

    /**
     * 处理鼠标移动事件，更新形状尺寸。
     * @param {object} e - Konva 事件对象。
     */
    handleMouseMove(e) {
        // console.log(this.isDrawing);
        if (!this.isDrawing || !this.currentShape) return;

        const pos = this.stage.getPointerPosition();
        if (!pos) return;

        const scale = this.stage.scaleX();
        const stagePos = { x: (pos.x - this.stage.x()) / scale, y: (pos.y - this.stage.y()) / scale };

        // 将当前点也限制在图片范围内
        const point = this.imageManager.getClampedPos(stagePos.x, stagePos.y);

        // 根据形状类型更新尺寸
        if (this.currentShape instanceof Konva.Rect) {
            this.currentShape.width(point.x - this.startPoint.x);
            this.currentShape.height(point.y - this.startPoint.y);
        } else if (this.currentShape instanceof Konva.Circle) {
            const dx = point.x - this.startPoint.x;
            const dy = point.y - this.startPoint.y;
            this.currentShape.radius(Math.sqrt(dx * dx + dy * dy));
        }
    }

    /**
     * 处理鼠标抬起事件，完成绘制。
     * @param {object} e - Konva 事件对象。
     */
    handleMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const shape = this.currentShape;
        if (!shape) return;

        // 标准化矩形，确保宽和高为正值
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

        // 检查标注框是否太小，如果太小则销毁
        const isTooSmall = (shape instanceof Konva.Rect && (Math.abs(shape.width()) < 10 || Math.abs(shape.height()) < 10)) ||
            (shape instanceof Konva.Circle && shape.radius() < 5);

        if (isTooSmall) {
            this.resetCurrentShape(); // 销毁形状
            return; // 不触发 onDrawEnd
        }

        // 触发绘制结束的回调，将最终形状传递给主组件
        this.options.onDrawEnd(shape);

        // 主组件将接管此形状，DrawingManager 不再持有它的引用
        this.currentShape = null;
    }
}

export default DrawingManager;