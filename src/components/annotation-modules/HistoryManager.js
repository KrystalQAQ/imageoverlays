/**
 * 管理操作历史，支持撤销和重做。
 */
class HistoryManager {
    constructor(onStateChange) {
        this.history = [[]]; // 初始状态为一个空的标注列表
        this.historyIndex = 0;
        this.onStateChange = onStateChange; // 状态改变时的回调
    }

    /**
     * 将新状态推入历史记录栈。
     * @param {Array} state - 当前的标注数据快照。
     * @param {string} actionName - 描述此次操作的名称。
     */
    push(state, actionName = 'Unknown') {
        // 如果当前不在历史记录的末尾（即执行过 undo），则截断后续历史
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push({
            state,
            actionName,
            id: this.history.length
        });
        this.historyIndex++;
        this.onStateChange(this.getHistoryForDisplay());
    }

    getHistoryState() {
        return {
            history: this.history,
            historyIndex: this.historyIndex,
        };
    }

    setHistoryState({ history, historyIndex }) {
        this.history = history && history.length > 0 ? history : [{ state: [], actionName: '初始化', id: 0 }];
        this.historyIndex = historyIndex || 0;
        this.onStateChange(this.getHistoryForDisplay());
        return this.getCurrentState();
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.onStateChange(this.getHistoryForDisplay());
            return this.getCurrentState();
        }
        return null;
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.onStateChange(this.getHistoryForDisplay());
            return this.getCurrentState();
        }
        return null;
    }

    goToState(index) {
        if (index >= 0 && index < this.history.length) {
            this.historyIndex = index;
            this.onStateChange(this.getHistoryForDisplay());
            return this.getCurrentState();
        }
        return null;
    }

    getCurrentState() {
        return this.history[this.historyIndex]?.state;
    }

    reset() {
        this.history = [{ state: [], actionName: '初始化', id: 0 }];
        this.historyIndex = 0;
        this.onStateChange(this.getHistoryForDisplay());
    }

    /**
     * 生成用于在 UI 中显示的历史记录列表。
     */
    getHistoryForDisplay() {
        return this.history.map((item, index) => ({
            id: item.id,
            name: item.actionName,
            active: index === this.historyIndex,
        }));
    }
}

export default HistoryManager;