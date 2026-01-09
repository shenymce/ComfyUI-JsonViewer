// json-viewer-optimized.js
import {app} from "../../scripts/app.js";
import {ComfyWidgets} from "../../scripts/widgets.js";

app.registerExtension({
    name: "JsonViewerOptimized",

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "JsonViewer") {

            const VALUES = Symbol();

            // 格式化JSON的辅助函数
            function formatJson(jsonText, indent = 2) {
                try {
                    const obj = JSON.parse(jsonText);
                    return JSON.stringify(obj, null, indent);
                } catch (e) {
                    // 如果解析失败，返回原始文本
                    return jsonText;
                }
            }

            // 添加类型信息的辅助函数
            function addTypeInfo(jsonObj) {
                if (!jsonObj || typeof jsonObj !== 'object') {
                    return jsonObj;
                }

                // 深度优先遍历添加类型信息
                function addTypes(obj, path = '') {
                    if (Array.isArray(obj)) {
                        obj.__type__ = `Array[${obj.length}]`;
                        obj.forEach((item, index) => {
                            if (item && typeof item === 'object') {
                                addTypes(item, `${path}[${index}]`);
                            } else {
                                // 为基本类型添加类型信息
                                const key = `__type__`;
                                if (!obj.hasOwnProperty(key)) {
                                    Object.defineProperty(obj, key, {
                                        value: typeof item,
                                        enumerable: false,
                                        configurable: true
                                    });
                                }
                            }
                        });
                    } else if (obj && typeof obj === 'object') {
                        obj.__type__ = 'Object';
                        for (const key in obj) {
                            if (obj.hasOwnProperty(key) && obj[key] && typeof obj[key] === 'object') {
                                addTypes(obj[key], path ? `${path}.${key}` : key);
                            } else if (obj.hasOwnProperty(key)) {
                                // 为基本类型添加类型信息
                                const typeKey = `${key}__type__`;
                                if (!obj.hasOwnProperty(typeKey)) {
                                    obj[typeKey] = typeof obj[key];
                                }
                            }
                        }
                    }
                }

                addTypes(jsonObj);
                return jsonObj;
            }

            // 提取OpenPose数据的辅助函数
            function extractOpenPoseData(jsonObj) {
                if (!jsonObj || typeof jsonObj !== 'object') {
                    return jsonObj;
                }

                // 如果是完整的数据结构，提取data字段
                if (jsonObj.data && Array.isArray(jsonObj.data)) {
                    return jsonObj.data.map(item => {
                        if (item && typeof item === 'object') {
                            // 只保留OpenPose相关字段
                            const filtered = {};
                            const openposeKeys = [
                                'people', 'pose_keypoints_2d', 'face_keypoints_2d',
                                'hand_left_keypoints_2d', 'hand_right_keypoints_2d',
                                'canvas_height', 'canvas_width'
                            ];

                            for (const key of openposeKeys) {
                                if (item[key] !== undefined) {
                                    filtered[key] = item[key];
                                }
                            }
                            return filtered;
                        }
                        return item;
                    }).filter(item =>
                        item && typeof item === 'object' &&
                        Object.keys(item).length > 0
                    );
                }

                return jsonObj;
            }

            // 主显示函数
            function populate(content, type_content = "") {
                // 清理现有的显示widgets（保留前4个参数widgets）
                if (this.widgets) {
                    const paramWidgetCount = Math.min(this.widgets.length, 4);
                    for (let i = paramWidgetCount; i < this.widgets.length; i++) {
                        this.widgets[i]?.onRemove?.();
                    }
                    this.widgets.length = paramWidgetCount;
                }

                // 获取参数值
                let autoFormat = true;
                let showTypes = false;
                let onlyShowOpenPose = false;

                if (this.widgets && this.widgets.length >= 4) {
                    // 获取参数值
                    autoFormat = this.widgets[0]?.value === "true"; // auto_format
                    showTypes = this.widgets[1]?.value === "true";  // show_types
                    onlyShowOpenPose = this.widgets[2]?.value === "true"; // only_show_openpose
                }

                // 处理内容：修复字符数组问题
                let jsonText = "";

                if (Array.isArray(content)) {
                    // 如果是字符数组（每个元素是单个字符）
                    if (content.length > 0 && typeof content[0] === 'string' && content[0].length === 1) {
                        jsonText = content.join('');
                    } else {
                        // 尝试作为JSON处理
                        try {
                            jsonText = JSON.stringify(content, null, 2);
                        } catch (e) {
                            jsonText = content.join(' ');
                        }
                    }
                } else if (typeof content === 'string') {
                    jsonText = content;
                } else if (content) {
                    try {
                        jsonText = JSON.stringify(content, null, 2);
                    } catch (e) {
                        jsonText = String(content);
                    }
                }
                let jsonTypeContent = "";
                if (type_content) {
                    try {
                        jsonTypeContent = JSON.parse(type_content);
                    } catch (e) {
                        jsonTypeContent = [];
                    }
                }

                // 处理JSON数据
                try {
                    let jsonObj = JSON.parse(jsonText);
                    let jsonTypeObj = jsonTypeContent;
                    // 应用OpenPose过滤
                    if (onlyShowOpenPose) {
                        jsonObj = extractOpenPoseData(jsonObj);
                    }

                    // 应用类型信息
                    if (showTypes) {
                        jsonObj["type_info"] = jsonTypeContent;
                    }

                    // 应用格式化
                    const indent = autoFormat ? 2 : undefined;
                    jsonText = JSON.stringify(jsonObj, null, indent);

                } catch (e) {
                    console.warn("Failed to process JSON:", e.message);
                    // 保持原始文本
                }

                // 创建显示widget
                const widget = ComfyWidgets["STRING"](this, "json_display", ["STRING", {
                    multiline: true,
                    dynamicPrompts: false
                }], app).widget;

                // 设置为只读并应用样式
                widget.inputEl.readOnly = true;
                widget.inputEl.style.cssText = `
                    opacity: 0.95;
                    font-family: 'Monaco', 'Menlo', 'Consolas', monospace !important;
                    font-size: ${autoFormat ? '11px' : '10px'} !important;
                    background-color: #1e1e1e !important;
                    color: #d4d4d4 !important;
                    border: 1px solid #444 !important;
                    border-radius: 4px !important;
                    white-space: pre !important;
                    overflow: auto !important;
                    resize: vertical !important;
                    min-height: 100px !important;
                    line-height: 1.4 !important;
                    tab-size: ${autoFormat ? '2' : '1'} !important;
                `;

                // 设置值
                widget.value = jsonText;
                widget.inputEl.value = jsonText;

                // 应用语法高亮
                if (autoFormat) {
                    setTimeout(() => {
                        applySyntaxHighlighting(widget.inputEl);
                    }, 100);
                }

                // 调整节点大小
                requestAnimationFrame(() => {
                    try {
                        const sz = this.computeSize();

                        // 根据内容调整宽度
                        const minWidth = autoFormat ? 450 : 350;
                        if (sz[0] < minWidth) {
                            sz[0] = minWidth;
                        }

                        // 根据行数调整高度
                        const lineCount = jsonText.split('\n').length;
                        const lineHeight = autoFormat ? 16 : 14;
                        const textHeight = Math.min(lineCount * lineHeight, 800);
                        const minHeight = Math.max(200, textHeight + 80);
                        if (sz[1] < minHeight) {
                            sz[1] = minHeight;
                        }

                        this.onResize?.(sz);
                        app.graph.setDirtyCanvas(true, false);
                    } catch (e) {
                        console.error("Error resizing:", e);
                    }
                });
            }

            // 语法高亮函数
            function applySyntaxHighlighting(element) {
                try {
                    const text = element.value;
                    let html = text
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');

                    // 高亮JSON语法
                    html = html.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="json-string">$1</span>');
                    html = html.replace(/\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>');
                    html = html.replace(/\b(true|false|null)\b/g, '<span class="json-literal">$1</span>');
                    html = html.replace(/("([^"\n\r]+?)"(?=\s*:))/g, '<span class="json-key">$1</span>');

                    // 高亮类型信息
                    html = html.replace(/("__type__"\s*:\s*"[^"]*")/g, '<span class="json-type">$1</span>');
                    html = html.replace(/("[^"]*__type__"\s*:\s*"[^"]*")/g, '<span class="json-type">$1</span>');

                    element.innerHTML = html;
                } catch (e) {
                    console.warn("Syntax highlighting failed:", e);
                }
            }

            // 重写 onExecuted 方法
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                // 提取要显示的内容
                let content = "";
                let type_content = "";

                if (message && message.ui) {
                    // 优先使用 ui.text
                    if (message.ui.text !== undefined) {
                        content = message.ui.text;
                    }
                    // 其次使用 ui.json_data
                    else if (message.ui.json_data !== undefined) {
                        try {
                            content = JSON.stringify(message.ui.json_data, null, 2);
                        } catch (e) {
                            content = String(message.ui.json_data);
                        }
                    }
                } else if (message && message.text) {
                    content = message.text;
                } else if (message) {
                    try {
                        content = JSON.stringify(message, null, 2);
                    } catch (e) {
                        content = String(message);
                    }
                }

                let flag = 0;
                if (message && message.type_info !== undefined) {
                    try {
                        if (Array.isArray(message.type_info)) {
                            type_content = message.type_info.join('');
                        } else {
                            type_content = JSON.stringify(message.type_info, null, 2);
                        }
                    } catch (e) {
                        flag = 2;
                        type_content = String(message.type_info);
                    }
                }

                // 调用显示函数
                populate.call(this, content, type_content);
            };

            // 配置相关方法
            const configure = nodeType.prototype.configure;
            nodeType.prototype.configure = function () {
                if (arguments[0]?.widgets_values) {
                    this[VALUES] = arguments[0].widgets_values;
                }
                return configure?.apply(this, arguments);
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function () {
                onConfigure?.apply(this, arguments);

                const widgets_values = this[VALUES];
                if (widgets_values?.length > 4) {
                    requestAnimationFrame(() => {
                        const displayContent = widgets_values[4];
                        if (displayContent) {
                            // 获取保存的参数值
                            const autoFormat = widgets_values[0] === "true";
                            const showTypes = widgets_values[1] === "true";
                            const onlyShowOpenPose = widgets_values[2] === "true";
                            populate.call(this, displayContent);
                        }
                    });
                }
            };

            // 监听参数变化
            const onWidgetChange = nodeType.prototype.onWidgetChange;
            nodeType.prototype.onWidgetChange = function (widget, value) {
                onWidgetChange?.apply(this, arguments);

                // 如果参数发生变化，重新显示
                if (widget.name === 'auto_format' || widget.name === 'show_types' || widget.name === 'only_show_openpose') {
                    // 如果有显示内容，重新处理
                    if (this.widgets && this.widgets.length > 4) {
                        const displayWidget = this.widgets[4];
                        if (displayWidget && displayWidget.value) {
                            setTimeout(() => {
                                populate.call(this, displayWidget.value);
                            }, 100);
                        }
                    }
                }
            };

            const onRemoved = nodeType.prototype.onRemoved;
            nodeType.prototype.onRemoved = function () {
                delete this[VALUES];
                return onRemoved?.apply(this, arguments);
            };
        }
    },

    // 添加CSS样式
    async setup(app) {
        const style = document.createElement('style');
        style.textContent = `
            /* JSON 语法高亮 */
            .json-string { color: #ce9178 !important; }
            .json-number { color: #b5cea8 !important; }
            .json-literal { color: #569cd6 !important; }
            .json-key { color: #9cdcfe !important; font-weight: bold !important; }
            .json-type { color: #dcdcaa !important; font-style: italic !important; }
            .json-comment { color: #6a9955 !important; }
            
            /* 优化滚动条 */
            .node textarea::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }
            
            .node textarea::-webkit-scrollbar-track {
                background: #1a1a1a;
                border-radius: 6px;
            }
            
            .node textarea::-webkit-scrollbar-thumb {
                background: #444;
                border-radius: 6px;
                border: 2px solid #1a1a1a;
            }
            
            .node textarea::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
            
            .node textarea::-webkit-scrollbar-corner {
                background: #1a1a1a;
            }
            
            /* 优化选择文本 */
            .node textarea::selection {
                background-color: #264f78 !important;
                color: white !important;
            }
            
            /* 优化焦点状态 */
            .node textarea:focus {
                outline: 2px solid #007acc !important;
                outline-offset: -2px !important;
            }
        `;
        document.head.appendChild(style);
    }
});