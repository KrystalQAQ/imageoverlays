import Konva from 'konva';

class ImageManager {
  constructor(stageManager) {
    this.stageManager = stageManager;
    this.stage = stageManager.getStage();
    this.imageLayer = stageManager.getImageLayer();

    this.originalImage = null;
    this.imageSize = { width: 0, height: 0 };
    this.imagePosition = { x: 0, y: 0 };
    this.konvaImage = null;
  }

  async loadImage(imageSrc) {
    return new Promise((resolve, reject) => {
      if (!imageSrc || !this.stage) {
        return reject(new Error('Image source and stage are required.'));
      }

      const image = new Image();
      image.src = imageSrc;
      image.onload = () => {
        this.originalImage = image;
        this.resetView();

        if (this.konvaImage) {
          this.konvaImage.destroy();
        }

        this.konvaImage = new Konva.Image({
          ...this.imagePosition,
          ...this.imageSize,
          image: image,
          name: 'background-image',
        });

        this.imageLayer.add(this.konvaImage);
        resolve(this.originalImage);
      };
      image.onerror = (err) => {
        reject(err);
      };
    });
  }

  resetView() {
    if (!this.originalImage) return;

    this.stage.position({ x: 0, y: 0 });
    this.stage.scale({ x: 1, y: 1 });

    const stageWidth = this.stage.width();
    const stageHeight = this.stage.height();
    const scale = Math.min(stageWidth / this.originalImage.width, stageHeight / this.originalImage.height);

    this.imageSize = { width: this.originalImage.width * scale, height: this.originalImage.height * scale };
    this.imagePosition = {
      x: (stageWidth - this.imageSize.width) / 2,
      y: (stageHeight - this.imageSize.height) / 2
    };

    if (this.konvaImage) {
      this.konvaImage.setAttrs({
        ...this.imagePosition,
        ...this.imageSize,
      });
    }
  }

  /**
   * 将给定的坐标点限制在图片边界内。
   * @param {number} x - x 坐标。
   * @param {number} y - y 坐标。
   * @returns {{x: number, y: number}} - 限制后的坐标。
   */
  getClampedPos(x, y) {
    return {
      x: Math.max(this.imagePosition.x, Math.min(x, this.imagePosition.x + this.imageSize.width)),
      y: Math.max(this.imagePosition.y, Math.min(y, this.imagePosition.y + this.imageSize.height)),
    };
  }

  getOriginalImage() {
    return this.originalImage;
  }

  getImageSize() {
    return this.imageSize;
  }

  getImagePosition() {
    return this.imagePosition;
  }

  getKonvaImage() {
    return this.konvaImage;
  }
}

export default ImageManager;