<template>
    <div
        style="
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        "
    >
        <section class="toolbar">
            <div
                :class="['toolbar-item', getClass(0)]"
                @click="clickHandler(0)"
            >
                <svg
                    t="1735012626555"
                    class="icon"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="4299"
                    width="200"
                    height="200"
                >
                    <path
                        d="M781.963636 193.473939L204.179394 771.165091V193.473939H781.963636zM248.087273 815.041939L826.088727 237.102545v577.939394H248.087273zM50.579394 193.691152c0.310303 0 0.558545-0.217212 0.868848-0.217213H142.118788v652.598303c0 0.434424-0.186182 0.806788-0.155152 1.241213 0.682667 17.221818 15.173818 30.72 32.426667 30.006303 0.310303 0 0.558545-0.186182 0.868849-0.217213h650.798545v93.09091c0 0.434424-0.186182 0.806788-0.155152 1.241212a31.123394 31.123394 0 1 0 62.184728-1.210182v-0.248243c0-0.310303 0.217212-0.620606 0.186182-0.992969 0-0.248242-0.124121-0.403394-0.155152-0.620606v-91.229091h92.718545c0.434424 0 0.837818 0.217212 1.303273 0.186182a31.278545 31.278545 0 1 0-2.451394-62.495031c-0.310303 0.03103-0.558545 0.217212-0.868848 0.217212h-90.701576V175.041939l83.471515-83.471515a30.937212 30.937212 0 0 0 9.309091-23.210666 31.247515 31.247515 0 0 0-32.426667-30.006303 30.906182 30.906182 0 0 0-22.155636 10.736484L844.024242 131.413333H204.179394v-93.090909c0-0.434424 0.217212-0.775758 0.217212-1.210182a31.123394 31.123394 0 0 0-62.215758 1.210182H142.118788v0.217212c0 0.341333-0.155152 0.651636-0.155152 0.99297 0 0.248242 0.155152 0.434424 0.155152 0.682667v91.229091H49.493333c-0.465455 0-0.868848-0.279273-1.334303-0.248243a31.247515 31.247515 0 1 0 2.420364 62.495031z"
                        fill="#285085"
                        p-id="4300"
                    ></path>
                </svg>
            </div>
            <div
                :class="['toolbar-item', getClass(1)]"
                @click="clickHandler(1)"
            >
                <svg
                    t="1735012662730"
                    class="icon"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="5309"
                    width="200"
                    height="200"
                >
                    <path
                        d="M511.99 960.22C264.84 960.22 63.77 759.15 63.77 512S264.84 63.78 511.99 63.78 960.23 264.85 960.23 512 759.14 960.22 511.99 960.22z m0-823.81C304.88 136.41 136.4 304.89 136.4 512s168.48 375.59 375.59 375.59c207.13 0 375.61-168.48 375.61-375.59S719.12 136.41 511.99 136.41z"
                        fill="#6C6D6E"
                        p-id="5310"
                    ></path>
                </svg>
            </div>
        </section>
        <div style="width: 100%; height: 20px">
            <!-- <el-button type="primary" @click="getBase64">导出</el-button> -->
        </div>
        <div ref="mark" id="leaferView" class="mark"></div>

        <div>
            <div class="form-footer">
                <el-button type="primary" @click="handleSave">确认</el-button>
            </div>
        </div>
    </div>
</template>

<script>
import mark from "./mark.js";

export default {
    name: "markDialog",
    props: {
        markData: {
            type: Array,
            default: () => [],
        },
        image: {
            type: String,
            required: true,
            default:
                "https://img1.doubanio.com/view/status/medium/public/3b12e5d4b9f1e80.webp",
        },
    },

    computed: {
        getClass() {
            return function (idx) {
                return this.activeIndex === idx ? "active" : "";
                // if (!App.drawingBoardInstance) return ''
                // return App.drawingBoardInstance?.tools?.toolbarActiveIndex.value === idx ? 'active' : ''
            };
        },
    },
    watch: {
        image(newVal) {
            // this.init()
            // console.log("标注图片", newVal);
            // this.changeImage(newVal)
        },
    },
    mounted() {
        // this.init()
        this.app = new mark({
            view: "leaferView",
            editor: {
                keyEvent: false,
                rotateable: false,
            },
            initType: "draw",
        });
        this.$emit("initMark", this.app);
        this.app.app.on("change", (data) => {
            this.$emit("update:markData", data);
        });
        this.app.setImage(this.image);
        this.app.readJson([...this.markData]);
    },
    beforeDestroy() {
        console.log("mark组件销毁");
        this.app.destroy();
    },
    data() {
        return {
            app: null,

            toolBarOptions: [
                {
                    name: "Rect",

                    strokeWidth: 3,
                    stroke: "rgba(0, 0, 0, 1)",
                },
                {
                    name: "Ellipse",
                    title: "矩形",
                },
            ],
            activeIndex: 0,
        };
    },
    methods: {
        handleSave() {
            this.app.exportBase64().then((result) => {
                console.log(result.data);
                this.$emit("changeMarkImage", result.data);
            });
        },

        getBase64() {
            return new Promise((resolve, reject) => {
                this.app.exportBase64().then((result) => {
                    console.log(result.data);
                    resolve(result.data);
                });
            });
        },
        clickHandler(idx) {
            this.activeIndex = idx;
            this.app.changeDrawType(this.toolBarOptions[idx].name);
        },
    },
};
</script>
<style scoped lang="scss">
.mark {
    margin-top: 25px;
    width: 100%;
    flex: 1;
    height: 300px;
}

.toolbar {
    display: flex;

    // width: 300px;
    height: 40px;

    width: 5%;
    border: 1px solid #dcdfe6;
    border-radius: 10px;
    padding: 6px 16px;

    &-item {
        padding: 10px;
        cursor: pointer;

        svg {
            width: 100%;
            height: 100%;
            &:hover {
                // background-color: #3f85ed;
                transform: scale(1.1);
            }
        }
    }

    .active {
        background-color: #3f85ed;
        border-radius: 5px;

        path {
            fill: #ffffff;
        }
    }
}
</style>
