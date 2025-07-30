import {
    App,
    Box,
    Canvas,
    MoveEvent,
    Rect,
    PointerEvent,
    Ellipse,
    DragEvent,
} from "leafer-ui";
import { EditorEvent } from "@leafer-in/editor";

class mark {
    history = [];
    currentIndex = -1;
    strokeWidth = 2.5;
    selectID;
    markBox;
    labelBox;
    img;
    ratio;
    box;
    ctx;
    strokeColor = "red";
    drawType = "Rect";
    app;
    image;
    imgCanvas;
    currentRect;
    isDrawing = false;
    scale = 1;
    startX = 0;
    startY = 0;
    container;
    offset;
    constructor(conf) {
        const app = new App({
            ...conf,
            wheel: {
                zoomMode: false,
            },
        });
        this.app = app;
        app.config.move.drag = false;
        app.editor.config.boxSelect = false;
        this.container = {
            width: app.width,
            height: app.height,
        };

        const box = new Box({});

        //标注框Box
        this.markBox = new Box({
            id: "markBox",
        });
        this.labelBox = new Box({
            id: "labelBox",
        });
        const img = new Image();
        this.img = img;

        app.tree.add(box);
        app.tree.add(this.markBox);
        app.tree.add(this.labelBox);

        this.box = box;
        this.initBackground();
        if (conf.initType === "view") {
            this.setMode("view");
        } else {
            this.setMode("draw");
            app.on(PointerEvent.DOWN, this.onPointerDown.bind(this));
            app.on(PointerEvent.MOVE, this.onPointerMove.bind(this));
            app.on(PointerEvent.UP, this.onPointerUp.bind(this));

        }
        app.editor.on(EditorEvent.SELECT, (e) => {
            if (e.editor.list.length > 0) {
                this.selectID = e.editor.list[0].id;
            } else {
                this.selectID = null;
            }
        });
        app.editor.on(DragEvent.END, (e) => {

            this.app.emit("change", this.expertJson());
        });
        app.on(MoveEvent.MOVE, function (e) {
            app.tree.moveWorld(e.moveX, e.moveY);
        });
        app.on("change", (data) => {
            this.history.push(data);
            this.currentIndex = this.history.length - 1;
        });
    }
    destroy() {
        this.app.destroy();
    }
    reset() {
        // console.log("reset");
        this.markBox.clear();
        // this.labelBox.clear();
        this.history = [];
        // this.currentIndex = -1;
    }
    exportBase64() {
        return this.app.export('jpg')
    }

    changeDrawType(type) {
        this.drawType = type;
    }
    zoomChange(type) {
        this.app.tree.zoom(type);
    }
    initBackground() {
        const canvas = new Canvas({
            width: this.container.width,
            height: this.container.height,
        });
        const { context } = canvas;

        this.ctx = context;

        this.imgCanvas = canvas;
        this.imgCanvas.paint(); // 更新渲染
        this.box.add(canvas);
    }
    selectByID(id) {
        const box = this.markBox.find("#" + id);

        if (box) {
            this.app.editor.select(box);
        }
    }
    removeByID(id) {
        const box = this.markBox.find("#" + id);
        if (box.length > 0) {
            this.app.editor.cancel();
            box[0].remove();
            this.app.emit("change", this.expertJson());
            // this.labelDraw();
        }
    }

    removeBySelect() {
        const box = this.app.editor.element;
        if (box) {
            box.off_();
            this.app.editor.cancel();
            box.remove();
            this.app.emit("change", this.expertJson());

            // this.labelDraw();
        }
    }
    onPointerDown(event) {
        if (this.app.editor.editing) return;
        this.isDrawing = true;
        const { x, y } = this.markBox.getBoxPoint(event);
        if (x <= 0 || y <= 0) return;
        this.startX = x;
        this.startY = y;
        if (this.drawType === "Rect") {
            this.currentRect = new Rect({
                // id: nanoid(),
                x: this.startX,
                y: this.startY,
                dragBounds: "parent",
                width: 1, // 设置默认最小宽度
                height: 1, // 设置默认最小高度
                stroke: this.strokeColor,
                editable: true,
                strokeWidth: this.strokeWidth,
            });
        } else {
            this.currentRect = new Ellipse({
                x: this.startX,
                y: this.startY,
                width: 1,
                height: 1,
                stroke: this.strokeColor,
                editable: true,
                // fill: "rgb(50,205,121)"
                strokeWidth: this.strokeWidth,

            });
        }
        this.currentRect.index = this.markBox.children.length - 1;

        this.markBox.add(this.currentRect);
    }

    onPointerMove(event) {
        if (this.isDrawing && this.currentRect) {
            const { x, y } = this.markBox.getBoxPoint(event);
            const currentY = y;
            const currentX = x;

            // 更新矩形框的大小
            this.currentRect.set({
                width: Math.abs(currentX - this.startX),
                height: Math.abs(currentY - this.startY),
                x: Math.min(currentX, this.startX),
                y: Math.min(currentY, this.startY),
            });
        }
    }
    /**
     * 绘制标签
     */
    labelDraw() {
        // this.labelBox.clear();
        this.markBox.children.forEach((element, index) => {
            let box, box2;

            let indexBox = {
                x: 0,
                y: 0,
            },
                _labelBox = {
                    x: 0,
                    y: 0,
                };
            //分element.scaleX 1/-1和element.scaleY 1/-1判断
            if (element.scaleX == 1 && element.scaleY == 1) {
                indexBox = {
                    x: element.x,
                    y: element.y - 22,
                };
                _labelBox = {
                    x: element.x,
                    y: element.y - 22,
                };
            } else if (element.scaleX == -1 && element.scaleY == 1) {
                indexBox = {
                    x: element.x - element.width,
                    y: element.y - 22,
                };
                _labelBox = {
                    x: element.x - element.width,
                    y: element.y - 22,
                };
            } else if (element.scaleX == 1 && element.scaleY == -1) {
                indexBox = {
                    x: element.x,
                    y: element.y - 22 - element.height,
                };

                _labelBox = {
                    x: element.x,
                    y: element.y - 22 - element.height,
                };
            } else if (element.scaleX == -1 && element.scaleY == -1) {
                indexBox = {
                    x: element.x - element.width,
                    y: element.y - 22 - element.height,
                };
                _labelBox = {
                    x: element.x - element.width,
                    y: element.y - 22 - element.height,
                };
            }

            box = new Box({
                x: indexBox.x,
                y: indexBox.y,
                fill: "#FF4B4B",

                children: [
                    {
                        tag: "Text",
                        text: index + "",
                        fill: "white",
                        padding: [0, 5],
                        textAlign: "left",
                        verticalAlign: "top",
                    },
                ],
            });
            this.labelBox.add(box);
            if (element.label) {
                box2 = new Box({
                    x: _labelBox.x + box.getLayoutBounds().width,
                    y: _labelBox.y,
                    children: [
                        {
                            tag: "Text",
                            text: element.label ? element.label : "" + "",
                            fill: "white",
                            padding: [0, 5],
                            textAlign: "left",
                            verticalAlign: "top",
                        },
                    ],
                });
                this.labelBox.add(box2);
            }
        });
    }

    async onPointerUp() {
        if (this.isDrawing && this.currentRect) {
            this.isDrawing = false;
            if (
                this.currentRect.width < 10 ||
                this.currentRect.x + this.currentRect.width > this.markBox.width
            ) {
                this.currentRect.remove();
            } else {
                // let labelData = await new Promise((resolve, reject) => {
                //   this.app.emit("oncomplete", { ok: resolve, err: reject });
                // }).catch(() => {
                //   this.currentRect.remove();
                //   this.currentRect = null;
                //   throw Error("The mark object has not been assigned a label.");
                // });
                // this.currentRect.label = labelData;
                // console.log(labelData);
                // this.labelDraw();

                this.app.emit("change", this.expertJson());
            }
            this.currentRect = null;
        }
    }
    /**
     *
     * @param type 历史记录回溯
     */
    nextStep(type) {
        this.app.editor.cancel();

        if (type === "+" && this.currentIndex < this.history.length - 1) {
            this.currentIndex = this.currentIndex + 1;
        } else if (type === "-" && this.currentIndex > 0) {
            this.currentIndex = this.currentIndex - 1;
        }
        this.markBox.clear();
        this.readJson(this.history[this.currentIndex], true);

        console.log(this.currentIndex, this.history[this.currentIndex]);
    }
    /**
     * 导出Json
     * @returns json数据
     */
    expertJson() {
        const json = this.markBox.toJSON().children;
        // console.log(this.markBox.toJSON());
        let data = json.map((item) => {
            let obj = {
                id: item.id,

                label: item.label,
                xmin: item.x / this.offset.ratio,
                ymin: item.y / this.offset.ratio,
                xmax: (item.x + item.width) / this.offset.ratio,
                ymax: (item.y + item.height) / this.offset.ratio,
            };

            return obj;
        });

        return data;
    }
    /**
     * 导入Json
     * @param data json数据
     * @param isHistory
     */
    readJson(data, isHistory = false) {
        data.forEach((item) => {
            let p1 = {
                x: item.xmin * this.offset.ratio,
                y: item.ymin * this.offset.ratio,
            };
            let p2 = {
                x: item.xmax * this.offset.ratio,
                y: item.ymax * this.offset.ratio,
            };
            this.newRect(
                p1.x,
                p1.y,
                p2.x - p1.x,
                p2.y - p1.y,
                item.id,
                item.label
            );
        });
        // this.labelDraw();
        if (!isHistory) {
            console.log("初始化");
            this.app.emit("change", this.expertJson());
            this.currentIndex = this.history.length;
        }
    }
    setImage(url) {
        this.img.src = url;
        this.markBox.clear();
        this.labelBox.clear();

        return new Promise((resolve, reject) => {
            this.img.onload = () => {
                this.drawImage();
                this.imgCanvas.paint(); // 更新渲染
                resolve(true);
            };
        });
    }
    drawImage() {
        const ctx = this.ctx;
        const canvas = this.container;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let canvasRatio = canvas.width / canvas.height;
        let imgRatio = this.img.width / this.img.height;

        let renderableWidth, renderableHeight, xStart, yStart;

        if (imgRatio < canvasRatio) {
            renderableHeight = canvas.height * this.scale;
            renderableWidth =
                this.img.width * (renderableHeight / this.img.height);
            this.ratio = renderableWidth / this.img.width;
        } else {
            renderableWidth = canvas.width * this.scale;
            renderableHeight =
                this.img.height * (renderableWidth / this.img.width);
            this.ratio = renderableHeight / this.img.height;
        }

        xStart = (canvas.width - renderableWidth) / 2;
        yStart = (canvas.height - renderableHeight) / 2;
        // console.log(xStart, yStart);
        // console.log(this.ratio);
        this.offset = {
            x: xStart,
            y: yStart,
            ratio: this.ratio,
        };
        this.markBox.x = xStart;
        this.markBox.y = yStart;
        this.markBox.width = renderableWidth;
        this.markBox.height = renderableHeight;

        this.labelBox.x = xStart;
        this.labelBox.y = yStart;
        this.labelBox.width = renderableWidth;
        this.labelBox.height = renderableHeight;
        // console.log(this.markBox);
        ctx.drawImage(
            this.img,
            xStart,
            yStart,
            renderableWidth,
            renderableHeight
        );
    }
    setMode(type) {
        if (type === "draw") {
            this.app.editor.config.selector = true;
        } else if (type === "view") {
            this.app.editor.config.selector = false;
        }
    }
}

export default mark;
